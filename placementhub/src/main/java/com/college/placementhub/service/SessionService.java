package com.college.placementhub.service;

import com.college.placementhub.model.ActiveSession;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Collections;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SessionService {
    private final Map<String, ActiveSession> liveSessions = new ConcurrentHashMap<>();
    public String createSession(String trainerUsername, String sessionTitle){
        String sessionId = UUID.randomUUID().toString();

        ActiveSession newSession = new ActiveSession(
                sessionId,
                sessionTitle,
                trainerUsername,
                System.currentTimeMillis()
        );
        liveSessions.put(sessionId, newSession);
        System.out.println("Universal Live Session Created: " + sessionId + " | Title: " + sessionTitle);
        return sessionId;
    }
    public boolean isValidSession(String sessionId){
        return liveSessions.containsKey(sessionId);
    }
    public boolean endSession(String sessionId, String reqUsername){
        ActiveSession session = liveSessions.get(sessionId);
        if(session == null){
            throw new IllegalArgumentException("Session Not Found or already terminated");
        }
        if(!session.getTrainerUsername().equals(reqUsername)){
            System.out.println("Unauthorized deletion attempted by " + reqUsername);
            return false;
        }
        liveSessions.remove(sessionId);
        System.out.println("Live Session Ended: "+sessionId+" by " + reqUsername);
        return true;
    }
    public ActiveSession getSessionDetails(String sessionId){
        return liveSessions.get(sessionId);
    }
    public Collection<ActiveSession> getAllActiveSessions() {
        return liveSessions.values();
    }
}
