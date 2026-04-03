package com.college.placementhub.controller;

import com.college.placementhub.dto.SessionRequest;
import com.college.placementhub.dto.SessionResponse;
import com.college.placementhub.model.ActiveSession;
import com.college.placementhub.security.UserDetailsImpl;
import com.college.placementhub.service.SessionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {
    @Autowired
    private SessionService sessionService;

    @PostMapping("/create")
    public ResponseEntity<?> startSession(@RequestBody SessionRequest request){
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) auth.getPrincipal();

        ActiveSession session = sessionService.createSession(userDetails.getUsername(), request.getSessionTitle());
        return ResponseEntity.ok(new SessionResponse(session.getSessionId(), session.getJoinCode(),session.getSessionTitle()));
    }
    @PostMapping("/join/{sessionId}")
    public ResponseEntity<?> joinSession(@PathVariable String sessionId, @RequestBody Map<String, String> payload){
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) auth.getPrincipal();
        String joinCode = payload.get("joinCode");
        if(joinCode == null || joinCode.trim().isEmpty()){
            return ResponseEntity.badRequest().body("Join code is required.");
        }
        try {
            boolean success = sessionService.joinSession(sessionId, userDetails.getUsername(), joinCode.trim());
            if(success){
                return ResponseEntity.ok("Joined successfully.");
            }else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Error: Session not found.");
            }
        }catch (IllegalArgumentException e){
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        }
    }
    @PostMapping("/leave/{sessionId}")
    public ResponseEntity<?> leaveSession(@PathVariable String sessionId){
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) auth.getPrincipal();

        sessionService.leaveSession(sessionId, userDetails.getUsername());
        return ResponseEntity.ok("Successfully left the session.");
    }
    @PostMapping("/{sessionId}/chat")
    public ResponseEntity<?> sendChatMessage(@PathVariable String sessionId, @RequestBody Map<String, String> payload){
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) auth.getPrincipal();
        String content = payload.get("content");
        if(content == null || content.trim().isEmpty()){
            return ResponseEntity.badRequest().body("Message cannot be empty.");
        }
        try{
            sessionService.broadcastChatMessage(sessionId, userDetails.getUsername(), content);
            return ResponseEntity.ok("Message sent.");
        }catch (IllegalArgumentException e){
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
    @GetMapping("/active")
    public ResponseEntity<?> getActiveSessions(){
        return ResponseEntity.ok(sessionService.getAllActiveSessions());
    }
    @DeleteMapping("/end/{sessionId}")
    public ResponseEntity<?> endSession(@PathVariable String sessionId){
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl user = (UserDetailsImpl) auth.getPrincipal();
       try{
           boolean isAuthorized = sessionService.endSession(sessionId, user.getUsername());
           if(isAuthorized){
               return ResponseEntity.ok("Session Terminated");
           }
           else{
               return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Error: you are not authorized to end this session.");
           }
       }catch(IllegalArgumentException e){
           return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Error: " + e.getMessage());
       }
    }
}
