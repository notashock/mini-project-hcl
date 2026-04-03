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

    const [notifications, setNotifications] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);   
    const [sharedFiles, setSharedFiles] = useState([]); 
    const [newMessage, setNewMessage] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    
    const chatEndRef = useRef(null);
    const stompClientRef = useRef(null); 
    const incomingFilesRef = useRef({}); 

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    useEffect(() => {
        const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
        const wsUrl = base.endsWith('/') ? `${base}ws-placement` : `${base}/ws-placement`;
        
        const socket = new SockJS(wsUrl);
        const stompClient = Stomp.over(socket);
        stompClient.debug = null; 
        stompClientRef.current = stompClient;

        stompClient.connect({}, () => {
            setIsConnected(true);
            
            // 1. Presence Listener
            stompClient.subscribe(`/topic/session/${sessionId}/presence`, (message) => {
                const payload = message.body;
                if (payload === "SESSION_TERMINATED") {
                    toast.error("Session ended by trainer.");
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

            // 3. Binary File Relay Listener
            stompClient.subscribe(`/topic/session/${sessionId}/file-stream`, (message) => {
                const data = JSON.parse(message.body);

                if (data.type === 'START') {
                    incomingFilesRef.current[data.fileId] = { metadata: data, chunks: [] };
                    toast(`Incoming file stream: ${data.fileName}`, { icon: '⬇️' });
                } 
                else if (data.type === 'CHUNK') {
                    if (incomingFilesRef.current[data.fileId]) {
                        incomingFilesRef.current[data.fileId].chunks[data.chunkIndex] = data.data;
                    }
                } 
                else if (data.type === 'END') {
                    const fileData = incomingFilesRef.current[data.fileId];
                    if (fileData) {
                        try {
                            const base64String = fileData.chunks.join('');
                            const byteCharacters = atob(base64String);
                            const byteNumbers = new Array(byteCharacters.length);
                            
                            for (let i = 0; i < byteCharacters.length; i++) {
                                byteNumbers[i] = byteCharacters.charCodeAt(i);
                            }
                            
                            const byteArray = new Uint8Array(byteNumbers);
                            const blob = new Blob([byteArray], { type: fileData.metadata.fileType });
                            
                            const fileUrl = URL.createObjectURL(blob);
                            setSharedFiles((prev) => [...prev, { ...fileData.metadata, url: fileUrl }]);
                            toast.success(`File ready: ${fileData.metadata.fileName}`);
                        } catch (e) {
                            console.error("Base64 Decoding Error:", e);
                            toast.error(`Transfer of ${fileData.metadata.fileName} was corrupted.`);
                        } finally {
                            delete incomingFilesRef.current[data.fileId];
                        }
                    }
                }
            });
        });

        const handleUnload = () => { api.post(`/sessions/leave/${sessionId}`).catch(() => {}); };
        window.addEventListener('beforeunload', handleUnload);

        return () => {
            window.removeEventListener('beforeunload', handleUnload);
            if (stompClientRef.current && stompClientRef.current.connected) {
                stompClientRef.current.disconnect();
            }
            api.post(`/sessions/leave/${sessionId}`).catch(() => {});
        };
    }, [sessionId, navigate]);

    const handleLeaveSession = async () => {
        try { await api.post(`/sessions/leave/${sessionId}`); } 
        catch (error) {} finally { navigate('/dashboard'); }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        try {
            await api.post(`/sessions/${sessionId}/chat`, { content: newMessage });
            setNewMessage('');
        } catch (error) { toast.error("Failed to send message."); }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file || !stompClientRef.current) return;

        const fileId = Math.random().toString(36).substring(7);
        // CRITICAL FIX: Must be perfectly divisible by 3 to prevent Base64 padding errors!
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
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64Data = window.btoa(binary);

            stompClientRef.current.send(`/app/session/${sessionId}/stream`, {}, JSON.stringify({
                type: 'CHUNK', fileId, chunkIndex, data: base64Data
            }));

            offset += CHUNK_SIZE;
            chunkIndex++;

            if (offset < file.size) {
                readNextChunk();
            } else {
                stompClientRef.current.send(`/app/session/${sessionId}/stream`, {}, JSON.stringify({
                    type: 'END', fileId
                }));
                toast.success("File streamed successfully!");
            }
        };

        const readNextChunk = () => {
            const slice = file.slice(offset, offset + CHUNK_SIZE);
            reader.readAsArrayBuffer(slice);
        };

        toast('Starting upload stream...', { icon: '📤' });
        readNextChunk();
        e.target.value = null; 
    };

    return (
        <div className="flex h-screen bg-gray-900 text-white">
            
            <div className="flex-1 p-8 flex flex-col border-r border-gray-700 min-w-0">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
                    <h1 className="text-3xl font-bold text-blue-400 truncate">Live Workspace</h1>
                    
                    {user?.username === trainer && joinCode && (
                        <div className="bg-gray-800 border-2 border-blue-500 rounded-lg px-6 py-1 text-center shadow-[0_0_15px_rgba(59,130,246,0.2)] ml-4">
                            <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-0.5">Room Code</span>
                            <span className="text-xl font-mono font-black text-blue-400 tracking-[0.2em]">{joinCode}</span>
                        </div>
                    )}

                    <div className="flex items-center gap-4 ml-4">
                        <span className="flex items-center gap-2 whitespace-nowrap">
                            <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                            {isConnected ? 'Connected' : 'Connecting...'}
                        </span>
                        <button 
                            onClick={handleLeaveSession}
                            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition font-semibold text-sm whitespace-nowrap"
                        >
                            Leave Room
                        </button>
                    </div>
                </div>

                {/* SHARED FILES HUB */}
                <div className="h-48 bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700 flex flex-col">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Shared Files</h2>
                        <label className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-bold cursor-pointer transition">
                            Share File
                            <input type="file" className="hidden" onChange={handleFileUpload} disabled={!isConnected} />
                        </label>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-2">
                        {sharedFiles.length === 0 ? (
                            <p className="text-gray-500 text-xs italic text-center mt-6">No files shared yet. Be the first!</p>
                        ) : (
                            sharedFiles.map((file, index) => (
                                <div key={index} className="flex justify-between items-center bg-gray-700 px-4 py-2 rounded">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <span className="text-xl">📄</span>
                                        <div className="truncate">
                                            <p className="text-sm font-semibold text-gray-200 truncate">{file.fileName}</p>
                                            <p className="text-[10px] text-gray-400">From: {file.sender} • {(file.fileSize / 1024).toFixed(1)} KB</p>
                                        </div>
                                    </div>
                                    <a 
                                        href={file.url} 
                                        download={file.fileName}
                                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-bold transition ml-4 shrink-0"
                                    >
                                        Download
                                    </a>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* CHAT WINDOW */}
                <div className="flex-1 bg-gray-800 rounded-lg p-4 mb-4 overflow-y-auto space-y-4 border border-gray-700">
                    {chatMessages.length === 0 ? (
                        <p className="text-gray-500 text-center mt-10">Session chat is empty. Say hello!</p>
                    ) : (
                        chatMessages.map((msg, index) => {
                            const isMe = msg.sender === user?.username;
                            return (
                                <div key={index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    <span className="text-xs text-gray-500 mb-1 px-1">{isMe ? 'You' : msg.sender}</span>
                                    <div className={`px-4 py-2 rounded-lg max-w-[70%] ${isMe ? 'bg-blue-600' : 'bg-gray-700'}`}>
                                        {msg.content}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className="flex gap-4 shrink-0">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message to the group..."
                        className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-3 border border-gray-600 focus:outline-none focus:border-blue-500"
                        autoComplete="off"
                    />
                    <button 
                        type="submit"
                        disabled={!newMessage.trim() || !isConnected}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-8 py-3 rounded-lg font-bold transition"
                    >
                        Send
                    </button>
                </form>
            </div>

            {/* PRESENCE TRACKER */}
            <div className="w-72 bg-gray-800 p-6 flex flex-col shrink-0">
                <h2 className="text-lg font-bold text-gray-300 uppercase tracking-wider mb-4 pb-2 border-b border-gray-700">
                    Room Activity
                </h2>
                <div className="flex-1 overflow-y-auto space-y-3">
                    {notifications.length === 0 ? (
                        <p className="text-gray-500 text-sm italic">No recent activity...</p>
                    ) : (
                        notifications.map((note, index) => (
                            <div key={index} className="text-sm text-gray-300 bg-gray-700 px-3 py-2 rounded-lg border-l-4 border-indigo-500">
                                {note}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}