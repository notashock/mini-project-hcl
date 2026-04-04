import { useEffect, useState, useContext, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

export default function SessionRoom() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useContext(AuthContext);
    const { joinCode, trainer } = location.state || {}; 

    // Data States
    const [notifications, setNotifications] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);   
    const [sharedFiles, setSharedFiles] = useState([]); 
    const [newMessage, setNewMessage] = useState('');
    
    // Status & Loading States
    const [isConnected, setIsConnected] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    
    // Detailed Progress States
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [incomingTransfers, setIncomingTransfers] = useState({}); 
    
    // Mobile Drawer State
    const [isActivityOpen, setIsActivityOpen] = useState(false);
    
    // Refs
    const chatEndRef = useRef(null);
    const stompClientRef = useRef(null); 
    const incomingFilesRef = useRef({}); 

    // Auto-scroll chat
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

    // WebSocket Connection & Cleanup
    useEffect(() => {
        // Gatekeeper: Wait for AuthContext to finish loading the user
        if (!user?.username) return; 

        let isMounted = true; // Prevents React 18 Strict Mode double-mounting zombies

        const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
        const wsUrl = base.endsWith('/') ? `${base}ws-placement` : `${base}/ws-placement`;
        
        const socket = new SockJS(wsUrl);
        const stompClient = Stomp.over(socket);
        stompClient.debug = null; 
        stompClientRef.current = stompClient;

        stompClient.connect({}, () => {
            // Safety Check: If component unmounted while connecting, kill it immediately
            if (!isMounted) {
                stompClient.disconnect();
                return;
            }

            setIsConnected(true);
            
            // 1. Presence Listener
            stompClient.subscribe(`/topic/session/${sessionId}/presence`, (message) => {
                const payload = message.body;
                if (payload === "SESSION_TERMINATED") {
                    toast.error("Session ended by trainer.", { duration: 5000 });
                    navigate('/dashboard'); 
                } else {
                    setNotifications((prev) => [...prev, payload]);
                }
            });

            // 2. Chat Listener
            stompClient.subscribe(`/topic/session/${sessionId}/chat`, (message) => {
                const chatData = JSON.parse(message.body);
                setChatMessages((prev) => [...prev, chatData]);
            });

            // 3. File Relay Listener
            stompClient.subscribe(`/topic/session/${sessionId}/file-stream`, (message) => {
                const data = JSON.parse(message.body);
                const isSender = data.sender === user?.username;

                if (data.type === 'START') {
                    incomingFilesRef.current[data.fileId] = { metadata: data, chunks: [] };
                    
                    if (!isSender) {
                        toast(`Incoming file: ${data.fileName}`, { icon: '⬇️' });
                        setIncomingTransfers(prev => ({
                            ...prev, 
                            [data.fileId]: { ...data, progress: 0 }
                        }));
                    }
                } 
                else if (data.type === 'CHUNK') {
                    if (incomingFilesRef.current[data.fileId]) {
                        incomingFilesRef.current[data.fileId].chunks[data.chunkIndex] = data.data;
                        
                        if (!isSender) {
                            const total = incomingFilesRef.current[data.fileId].metadata.totalChunks;
                            const currentProgress = Math.round((data.chunkIndex / total) * 100);
                            setIncomingTransfers(prev => {
                                if (!prev[data.fileId]) return prev;
                                return {
                                    ...prev,
                                    [data.fileId]: { ...prev[data.fileId], progress: currentProgress }
                                };
                            });
                        }
                    }
                } 
                else if (data.type === 'END') {
                    const fileData = incomingFilesRef.current[data.fileId];
                    if (fileData) {
                        try {
                            const base64String = fileData.chunks.join('');
                            const byteCharacters = atob(base64String);
                            const byteNumbers = new Array(byteCharacters.length);
                            for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                            const byteArray = new Uint8Array(byteNumbers);
                            const blob = new Blob([byteArray], { type: fileData.metadata.fileType });
                            const fileUrl = URL.createObjectURL(blob);
                            
                            setSharedFiles((prev) => [...prev, { ...fileData.metadata, url: fileUrl }]);
                            if (!isSender) toast.success(`Ready: ${fileData.metadata.fileName}`);
                        } catch (e) {
                            if (!isSender) toast.error(`Transfer of ${fileData.metadata.fileName} was corrupted.`);
                        } finally {
                            delete incomingFilesRef.current[data.fileId];
                            if (!isSender) {
                                setIncomingTransfers(prev => {
                                    const newState = { ...prev };
                                    delete newState[data.fileId];
                                    return newState;
                                });
                            }
                        }
                    }
                }
            });
        });

        // Unload logic ensures server is notified if tab is closed
        const handleUnload = () => { 
            const token = localStorage.getItem('token');
            const apiUrl = base.endsWith('/') ? `${base}api` : `${base}/api`;
            fetch(`${apiUrl}/sessions/leave/${sessionId}`, {
                method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, keepalive: true 
            }).catch(() => {});
        };
        window.addEventListener('beforeunload', handleUnload);

        return () => {
            isMounted = false;
            window.removeEventListener('beforeunload', handleUnload);
            
            // Aggressive disconnect to clear old socket references
            if (stompClientRef.current) {
                if (stompClientRef.current.connected) {
                    stompClientRef.current.disconnect();
                } else {
                    socket.close(); 
                }
            }
            if (!isLeaving) api.post(`/sessions/leave/${sessionId}`).catch(() => {});
        };
    }, [sessionId, navigate, isLeaving, user?.username]);

    const handleLeaveSession = async () => {
        if (isLeaving) return;
        setIsLeaving(true);
        toast('Disconnecting...', { icon: '👋' });
        try { await api.post(`/sessions/leave/${sessionId}`); } 
        catch (error) {} finally { navigate('/dashboard'); }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || isSendingMessage) return;
        setIsSendingMessage(true);
        try {
            await api.post(`/sessions/${sessionId}/chat`, { content: newMessage });
            setNewMessage('');
        } catch (error) { toast.error("Failed to send message."); } finally { setIsSendingMessage(false); }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file || !stompClientRef.current || isUploading) return;
        
        setIsUploading(true);
        setUploadProgress(0); 
        
        const fileId = Math.random().toString(36).substring(7);
        const CHUNK_SIZE = 16380; 
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        stompClientRef.current.send(`/app/session/${sessionId}/stream`, {}, JSON.stringify({
            type: 'START', fileId, fileName: file.name, fileType: file.type, fileSize: file.size, sender: user.username, totalChunks
        }));

        let offset = 0;
        let chunkIndex = 0;
        const reader = new FileReader();

        reader.onload = function(event) {
            const bytes = new Uint8Array(event.target.result);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
            
            stompClientRef.current.send(`/app/session/${sessionId}/stream`, {}, JSON.stringify({
                type: 'CHUNK', fileId, chunkIndex, data: window.btoa(binary)
            }));
            
            offset += CHUNK_SIZE;
            chunkIndex++;

            const currentProgress = Math.round((chunkIndex / totalChunks) * 100);
            setUploadProgress(currentProgress);

            if (offset < file.size) {
                readNextChunk();
            } else {
                stompClientRef.current.send(`/app/session/${sessionId}/stream`, {}, JSON.stringify({ type: 'END', fileId }));
                toast.success("File shared successfully!");
                setIsUploading(false); 
                setUploadProgress(0);
            }
        };
        
        reader.onerror = function() { 
            toast.error("Error reading file."); 
            setIsUploading(false); 
            setUploadProgress(0);
        };
        
        const readNextChunk = () => { reader.readAsArrayBuffer(file.slice(offset, offset + CHUNK_SIZE)); };
        
        readNextChunk();
        e.target.value = null; 
    };

    return (
        <div className="flex h-[100dvh] bg-gray-900 text-white font-sans overflow-hidden">
            
            {/* MAIN WORKSPACE */}
            <div className="flex-1 p-3 sm:p-4 lg:p-6 flex flex-col min-w-0 h-full relative">
                
                {/* HEADER */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b border-gray-700 shrink-0">
                    <div className="flex justify-between items-center w-full sm:w-auto">
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-400 truncate">Live Workspace</h1>
                        <button 
                            onClick={() => setIsActivityOpen(!isActivityOpen)}
                            className="xl:hidden text-gray-400 hover:text-white bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 text-xs font-bold transition"
                        >
                            {isActivityOpen ? 'Close Activity' : 'Show Activity'}
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end">
                        {user?.username === trainer && joinCode && (
                            <div className="bg-gray-800 border border-blue-500/50 rounded-lg px-3 sm:px-6 py-1 text-center shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                                <span className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-widest block mb-0.5">Room Code</span>
                                <span className="text-sm sm:text-xl font-mono font-black text-blue-400 tracking-[0.2em]">{joinCode}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-3 sm:gap-4">
                            <span className="flex items-center gap-1 sm:gap-2 whitespace-nowrap text-xs sm:text-sm font-semibold">
                                <span className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full shadow-lg ${isConnected ? 'bg-green-500 shadow-green-500/50 animate-pulse' : 'bg-red-500 shadow-red-500/50'}`}></span>
                                <span className={`hidden sm:inline ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                                    {isConnected ? 'Connected' : 'Connecting...'}
                                </span>
                            </span>
                            <button 
                                onClick={handleLeaveSession}
                                disabled={isLeaving}
                                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:opacity-50 px-3 sm:px-5 py-1.5 sm:py-2 rounded font-bold text-xs sm:text-sm whitespace-nowrap transition shadow-lg"
                            >
                                {isLeaving ? 'Leaving...' : 'Leave Room'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 50/50 SPLIT CONTENT AREA */}
                <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden pb-2">
                    
                    {/* LEFT PANEL: SHARED FILES */}
                    <div className="flex-1 lg:w-1/2 bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-700 flex flex-col shadow-inner min-h-0">
                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-700 shrink-0">
                            <h2 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <span className="text-blue-400">📁</span> Shared Files
                            </h2>
                            
                            {/* DYNAMIC UPLOAD BUTTON / PROGRESS BAR */}
                            {isUploading ? (
                                <div className="relative overflow-hidden w-24 sm:w-32 h-6 sm:h-8 rounded bg-gray-700 border border-gray-600 flex items-center justify-center">
                                    <div 
                                        className="absolute left-0 top-0 bottom-0 bg-blue-600 transition-all duration-200 ease-out" 
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                    <span className="relative z-10 text-[10px] sm:text-xs text-white font-bold drop-shadow-md">
                                        Uploading {uploadProgress}%
                                    </span>
                                </div>
                            ) : (
                                <label className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded text-[10px] sm:text-xs font-bold transition flex items-center gap-1 sm:gap-2 ${
                                    !isConnected 
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                                    : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-lg'
                                }`}>
                                    Share File
                                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={!isConnected} />
                                </label>
                            )}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {sharedFiles.length === 0 && Object.keys(incomingTransfers).length === 0 ? (
                                <div className="h-full flex items-center justify-center"><p className="text-gray-500 text-xs italic">No files shared yet.</p></div>
                            ) : (
                                <>
                                    {/* INCOMING ACTIVE TRANSFERS */}
                                    {Object.values(incomingTransfers)
                                        .filter(file => file.sender !== user?.username)
                                        .map((file) => (
                                            <div key={file.fileId} className="flex justify-between items-center bg-gray-700/50 px-3 py-2.5 rounded border border-blue-500/30">
                                                <div className="flex items-center gap-3 overflow-hidden w-full">
                                                    <span className="text-xl animate-bounce">⬇️</span>
                                                    <div className="truncate flex-1">
                                                        <p className="text-xs sm:text-sm font-bold text-gray-200 truncate">{file.fileName}</p>
                                                        <p className="text-[9px] sm:text-[10px] text-gray-400 font-semibold mt-0.5">
                                                            Incoming from <span className="text-blue-300">@{file.sender}</span>
                                                        </p>
                                                    </div>
                                                    
                                                    {/* INCOMING PROGRESS BAR */}
                                                    <div className="w-16 sm:w-24 bg-gray-800 h-3 sm:h-4 rounded overflow-hidden ml-2 border border-gray-600 shrink-0 relative flex justify-center items-center">
                                                        <div className="absolute left-0 top-0 bottom-0 bg-blue-500 transition-all duration-200" style={{ width: `${file.progress}%` }}></div>
                                                        <span className="text-[8px] sm:text-[9px] relative z-10 font-bold drop-shadow-md">{file.progress}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                    ))}

                                    {/* COMPLETED SHARED FILES */}
                                    {sharedFiles.map((file, index) => {
                                        const isSender = file.sender === user?.username;
                                        return (
                                            <div key={index} className="flex justify-between items-center bg-gray-700/50 px-3 py-2.5 rounded">
                                                <div className="flex items-center gap-3 overflow-hidden w-full">
                                                    <span className="text-xl">📄</span>
                                                    <div className="truncate flex-1">
                                                        <p className="text-xs sm:text-sm font-bold text-gray-200 truncate">{file.fileName}</p>
                                                        <p className="text-[9px] sm:text-[10px] text-gray-400 font-semibold mt-0.5">
                                                            {isSender ? (
                                                                <span className="text-green-400">Sent by you</span>
                                                            ) : (
                                                                <>From <span className="text-blue-300">@{file.sender}</span></>
                                                            )}
                                                            <span className="mx-1.5 text-gray-500">•</span> 
                                                            {(file.fileSize / 1024).toFixed(1)} KB
                                                        </p>
                                                    </div>
                                                    
                                                    {isSender ? (
                                                        <span className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wider px-2 sm:px-3 py-1 ml-2 shrink-0 border border-gray-600 rounded bg-gray-800">
                                                            Your File
                                                        </span>
                                                    ) : (
                                                        <a href={file.url} download={file.fileName} className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded text-[10px] sm:text-xs font-bold transition shrink-0 ml-2 shadow">
                                                            Download
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANEL: CHAT WINDOW */}
                    <div className="flex-1 lg:w-1/2 bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-700 flex flex-col shadow-inner min-h-0">
                        <div className="mb-3 pb-2 border-b border-gray-700 shrink-0">
                            <h2 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <span className="text-blue-400">💬</span> Live Chat
                            </h2>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                            {chatMessages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center opacity-50">
                                    <p className="text-xs sm:text-sm text-gray-400 font-semibold">Session chat is empty. Say hello!</p>
                                </div>
                            ) : (
                                chatMessages.map((msg, index) => {
                                    const isMe = msg.message === user?.username;
                                    return (
                                        <div key={index} className={`flex flex-col w-full ${isMe ? 'items-end' : 'items-start'}`}>
                                            <span className={`text-[9px] sm:text-[10px] uppercase font-bold mb-0.5 px-1 ${isMe ? 'text-blue-400' : 'text-gray-400'}`}>
                                                {isMe ? 'You' : `@${msg.message}`}
                                            </span>
                                            <div className={`px-3 sm:px-4 py-2 rounded-2xl max-w-[85%] sm:max-w-[75%] shadow-md text-xs sm:text-sm break-words ${
                                                isMe 
                                                ? 'bg-blue-600 text-white rounded-tr-none' 
                                                : 'bg-gray-700 text-gray-100 rounded-tl-none'
                                            }`}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* MESSAGE INPUT */}
                        <form onSubmit={handleSendMessage} className="flex gap-2 sm:gap-3 shrink-0 pt-3 mt-2 border-t border-gray-700">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder={isConnected ? "Type a message..." : "Connecting..."}
                                className="flex-1 bg-gray-900 text-white rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-50 text-xs sm:text-sm"
                                autoComplete="off"
                                disabled={!isConnected || isSendingMessage || isLeaving}
                            />
                            <button 
                                type="submit"
                                disabled={!newMessage.trim() || !isConnected || isSendingMessage || isLeaving}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:text-gray-400 text-white px-4 py-2 sm:py-2.5 rounded-lg font-bold transition flex justify-center items-center text-xs sm:text-sm min-w-[60px] sm:min-w-[80px]"
                            >
                                {isSendingMessage ? <span className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Send'}
                            </button>
                        </form>
                    </div>

                </div>
            </div>

            {/* RESPONSIVE PRESENCE TRACKER */}
            <div className={`
                fixed inset-y-0 right-0 z-50 w-64 sm:w-72 bg-gray-800 p-4 sm:p-6 flex flex-col border-l border-gray-700 shadow-2xl xl:shadow-none
                transform transition-transform duration-300 ease-in-out
                ${isActivityOpen ? 'translate-x-0' : 'translate-x-full'}
                xl:relative xl:translate-x-0
            `}>
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-700">
                    <h2 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <span className="text-green-400">⚡</span> Room Activity
                    </h2>
                    <button onClick={() => setIsActivityOpen(false)} className="xl:hidden text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-2 sm:space-y-3 custom-scrollbar pr-1">
                    {notifications.length === 0 ? (
                        <p className="text-gray-500 text-[10px] sm:text-xs font-semibold text-center mt-4">Waiting for activity...</p>
                    ) : (
                        notifications.map((note, index) => (
                            <div key={index} className="text-[10px] sm:text-xs font-semibold text-gray-300 bg-gray-700/50 p-2 sm:p-3 rounded border-l-4 border-blue-500 shadow-sm break-words">
                                {note}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {isActivityOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 xl:hidden" onClick={() => setIsActivityOpen(false)} />
            )}
        </div>
    );
}