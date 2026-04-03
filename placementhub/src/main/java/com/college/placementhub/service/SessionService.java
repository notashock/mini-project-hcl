package com.college.placementhub.service;

import com.college.placementhub.dto.ChatMessage;
import com.college.placementhub.model.ActiveSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Collections;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SessionService {
    @Autowired
    private SimpMessagingTemplate template;
    private final Map<String, ActiveSession> liveSessions = new ConcurrentHashMap<>();
    public ActiveSession createSession(String trainerUsername, String sessionTitle){
        String sessionId = UUID.randomUUID().toString();
        String joinCode = UUID.randomUUID().toString().substring(0, 6).toUpperCase();

        ActiveSession newSession = new ActiveSession(
                sessionId,
                sessionTitle,
                trainerUsername,
                joinCode,
                System.currentTimeMillis()
        );
        liveSessions.put(sessionId, newSession);
        System.out.println("Universal Live Session Created: " + sessionId + " | Title: " + sessionTitle + " | Code: " + joinCode);
        return newSession;
    }
    public boolean joinSession(String sessionId, String username, String providedCode){
        ActiveSession session = liveSessions.get(sessionId);
        if(session == null){
            return false;
        }
        if(!session.getJoinCode().equals(providedCode)){
            throw new IllegalArgumentException("Invalid joining code. access denied.");
        }
        session.getParticipants().add(username);
        String destination = "/topic/session/" + sessionId + "/presence";
        String message = username + " has joined the session!";

        template.convertAndSend(destination, message);
        System.out.println(username + " has joined the session: " + sessionId);
        return true;
    }
    public boolean leaveSession(String sessionId, String username){
        ActiveSession session = liveSessions.get(sessionId);
        if(session != null && session.getParticipants().contains(username)){
            session.getParticipants().remove(username);
            String message = username + " has left the session.";
            template.convertAndSend("/topic/session/" + sessionId + "/presence", message);

            System.out.println(username + " has left the session: " + sessionId);
            return true;
        }
        return false;
    }
    public void broadcastChatMessage(String sessionId, String sender, String content) {
        if(isValidSession(sessionId)){
            ChatMessage msg = new ChatMessage(sender, content, System.currentTimeMillis());
            template.convertAndSend("/topic/session/" + sessionId + "/chat", msg);
        }else {
            throw new IllegalArgumentException("Cannot send message. Session has ended.");
        }
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
        template.convertAndSend("/topic/session/" + sessionId + "/presence", "SESSION_TERMINATED");
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
