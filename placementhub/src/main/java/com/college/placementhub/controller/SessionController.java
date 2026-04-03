package com.college.placementhub.controller;

import com.college.placementhub.dto.SessionRequest;
import com.college.placementhub.dto.SessionResponse;
import com.college.placementhub.security.UserDetailsImpl;
import com.college.placementhub.service.SessionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/sessions")
public class SessionController {
    @Autowired
    private SessionService sessionService;

    @PostMapping("/create")
    public ResponseEntity<?> startSession(@RequestBody SessionRequest request){
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) auth.getPrincipal();

        String sessionId = sessionService.createSession(userDetails.getUsername(), request.getSessionTitle());
        return ResponseEntity.ok(new SessionResponse(sessionId, "Session '" + request.getSessionTitle() + "' started successfully."));
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
