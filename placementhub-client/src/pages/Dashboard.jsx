import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function Dashboard() {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [sessions, setSessions] = useState([]);
    const [sessionTitle, setSessionTitle] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const fetchSessions = async () => {
        try {
            const response = await api.get('/sessions/active');
            setSessions(response.data);
        } catch (error) {
            if (error.response?.status !== 401) {
                toast.error('Failed to load active sessions');
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const handleCreateSession = async (e) => {
        e.preventDefault();
        if (!sessionTitle.trim()) return;

        try {
            const response = await api.post('/sessions/create', { sessionTitle });
            toast.success(`Session Created! Code: ${response.data.joinCode}`, { duration: 5000 });
            setSessionTitle(''); 
            fetchSessions(); 
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to create session');
        }
    };

    const handleDeleteSession = async (sessionId) => {
        try {
            const response = await api.delete(`/sessions/end/${sessionId}`);
            toast.success(response.data);
            fetchSessions(); 
        } catch (error) {
            toast.error(error.response?.data || 'Failed to delete session');
        }
    };

    const handleJoinSession = async (session) => {
        let code = '';
        
        // Gatekeeper: Trainer uses their own code automatically, students are prompted
        if (user?.username === session.trainerUsername) {
            code = session.joinCode; 
        } else {
            code = window.prompt(`Enter the 6-digit Join Code for '${session.sessionTitle}':`);
            if (!code) return; 
        }

        try {
            await api.post(`/sessions/join/${session.sessionId}`, { joinCode: code });
            
            // Navigate and pass the state to the SessionRoom
            navigate(`/session/${session.sessionId}`, { 
                state: { joinCode: session.joinCode, trainer: session.trainerUsername } 
            });
        } catch (error) {
            toast.error(error.response?.data || 'Incorrect Join Code');
        }
    };

    const handleLogout = () => {
        logout(navigate);
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="flex justify-between items-center mb-10 pb-4 border-b border-gray-700">
                <div>
                    <h1 className="text-3xl font-bold text-blue-400">Placement Hub</h1>
                    <p className="text-gray-400 text-sm mt-1">Logged in as: <span className="text-green-400 font-semibold">{user?.username}</span></p>
                </div>
                
                <button 
                    onClick={handleLogout} 
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition"
                >
                    Logout
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1">
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h2 className="text-xl font-bold mb-4 text-gray-200">Start New Session</h2>
                        <form onSubmit={handleCreateSession} className="space-y-4">
                            <div>
                                <label className="block text-gray-400 mb-1 text-sm">Session Title</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                                    placeholder="e.g., TCS Interview Prep"
                                    value={sessionTitle}
                                    onChange={(e) => setSessionTitle(e.target.value)}
                                    required
                                />
                            </div>
                            <button 
                                type="submit" 
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition"
                            >
                                Create Session
                            </button>
                        </form>
                    </div>
                </div>

                <div className="md:col-span-2">
                    <h2 className="text-2xl font-bold mb-4 text-gray-200">Live Sessions</h2>
                    
                    {isLoading ? (
                        <p className="text-gray-400">Loading active sessions...</p>
                    ) : sessions.length === 0 ? (
                        <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 text-center">
                            <p className="text-gray-400">No active sessions right now.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {sessions.map((session) => (
                                <div key={session.sessionId} className="bg-gray-800 p-5 rounded-lg border border-gray-700 shadow flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-blue-300">{session.sessionTitle}</h3>
                                        <p className="text-sm text-gray-400 mt-1">
                                            Trainer: <span className="text-gray-200">{session.trainerUsername}</span>
                                        </p>
                                        
                                        {/* Display code only to the trainer */}
                                        {user?.username === session.trainerUsername && (
                                            <p className="text-sm text-green-400 mt-3 font-mono bg-gray-900 inline-block px-2 py-1 rounded border border-green-800">
                                                Code: <span className="font-bold tracking-widest">{session.joinCode}</span>
                                            </p>
                                        )}
                                    </div>
                                    
                                    <div className="mt-6 flex justify-between items-center gap-2">
                                        <button 
                                            onClick={() => handleJoinSession(session)}
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 px-3 rounded text-sm font-semibold transition"
                                        >
                                            Join Session
                                        </button>
                                        
                                        {user?.username === session.trainerUsername && (
                                            <button 
                                                onClick={() => handleDeleteSession(session.sessionId)}
                                                className="bg-red-600 hover:bg-red-700 text-white py-1.5 px-3 rounded text-sm font-semibold transition"
                                            >
                                                End
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}