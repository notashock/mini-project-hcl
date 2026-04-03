// src/pages/Dashboard.jsx
import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function Dashboard() {
    const { user, logout } = useContext(AuthContext);
    const [sessions, setSessions] = useState([]);
    const [sessionTitle, setSessionTitle] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // 1. Fetch Active Sessions
    const fetchSessions = async () => {
        try {
            const response = await api.get('/sessions/active');
            setSessions(response.data);
        } catch (error) {
            toast.error('Failed to load active sessions');
        } finally {
            setIsLoading(false);
        }
    };

    // Run once when the component mounts
    useEffect(() => {
        fetchSessions();
    }, []);

    // 2. Create a New Session
    const handleCreateSession = async (e) => {
        e.preventDefault();
        if (!sessionTitle.trim()) return;

        try {
            const response = await api.post('/sessions/create', { sessionTitle });
            toast.success(response.data.message);
            setSessionTitle(''); // Clear the input
            fetchSessions(); // Refresh the list to show the new session
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to create session');
        }
    };

    // 3. Delete an Existing Session
    const handleDeleteSession = async (sessionId) => {
        try {
            const response = await api.delete(`/sessions/end/${sessionId}`);
            toast.success(response.data);
            fetchSessions(); // Refresh the list
        } catch (error) {
            // This will catch our 403 Forbidden error from the backend if someone tries to hack it
            toast.error(error.response?.data || 'Failed to delete session');
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            {/* Header Section */}
            <div className="flex justify-between items-center mb-10 pb-4 border-b border-gray-700">
                <div>
                    <h1 className="text-3xl font-bold text-blue-400">Placement Hub</h1>
                    <p className="text-gray-400 text-sm mt-1">Logged in as: <span className="text-green-400 font-semibold">{user?.username}</span></p>
                </div>
                <button 
                    onClick={logout} 
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition"
                >
                    Logout
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Create Session Form */}
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

                {/* Right Column: Active Sessions List */}
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
                                    </div>
                                    
                                    <div className="mt-6 flex justify-between items-center gap-2">
                                        <button className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 px-3 rounded text-sm font-semibold transition">
                                            Join Session
                                        </button>
                                        
                                        {/* Security UI: Only show delete if the logged-in user is the creator */}
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