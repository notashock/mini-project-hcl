package com.college.placementhub.model;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ActiveSession {
    private String sessionId;
    private String sessionTitle;
    private String trainerUsername;
    private long createdAt;
}
