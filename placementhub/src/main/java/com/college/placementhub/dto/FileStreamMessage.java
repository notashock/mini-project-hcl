package com.college.placementhub.dto;

import lombok.Data;

@Data
public class FileStreamMessage {
    private String type;
    private String fileId;
    private String fileName;
    private String fileType;
    private long fileSize;
    private String sender;
    private int totalChunks;
    private int chunkIndex;
    private String data;
}
