package com.college.placementhub.controller;

import com.college.placementhub.dto.FileStreamMessage;
import com.college.placementhub.service.SessionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class FileStreamController {
    @Autowired
    private SimpMessagingTemplate template;

    @Autowired
    private SessionService sessionService;

    @MessageMapping("/session/{sessionId}/stream")
    public void relayFileChunk(@DestinationVariable String sessionId, @Payload FileStreamMessage message){
        if(sessionService.isValidSession(sessionId)){
            template.convertAndSend("/topic/session/" + sessionId + "/file-stream", message);
        }else {
            System.out.println("Block file transfer: Session " + sessionId + " is inactive.");
        }
    }
}
