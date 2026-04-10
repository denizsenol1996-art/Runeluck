/*
 * Decompiled with CFR 0.153-SNAPSHOT (d6f6758-dirty).
 */
package com.hazy.cache.anim;

import com.hazy.Client;
import com.hazy.cache.skeletal.SkeletalFrame;
import com.hazy.io.Buffer;

public interface SeqFrame {
    public static final SeqFrame[][] allFrames = new SeqFrame[32768][];

    public FrameBase getFrameBase();

    public boolean noAnimationInProgress();

    public static SeqFrame getFrame(int frameId) {
        if (frameId == -1) {
            return null;
        }
        int groupId = frameId >>> 16;
        SeqFrame[] frames = allFrames[groupId];
        if (frames == null) {
            Client.instance.resourceProvider.provide(1, groupId);
            return null;
        }
        int fileId = frameId & 0xFFFF;
        return fileId >= frames.length ? null : frames[fileId];
    }

    public static SeqFrame[] loadFrames(int groupId, byte[] data2) {
        SeqFrame[] frames = allFrames[groupId];
        if (frames != null) {
            return frames;
        }
        Buffer buffer = new Buffer(data2);
        int highestFileId = buffer.readUnsignedShort();
        SeqFrame.allFrames[groupId] = new SeqFrame[highestFileId + 1];
        frames = SeqFrame.allFrames[groupId];
        for (int i = 0; i <= highestFileId; ++i) {
            int fileId = buffer.readUnsignedShort();
            int fileSize = buffer.readMedium();
            byte[] fileData = buffer.readBytes(fileSize);
            int frameId = groupId << 16 | fileId;
            try {
                SeqFrame frame = SkeletalFrame.skeletalFrameIds.contains(groupId) ? new SkeletalFrame(groupId, fileData) : new NormalFrame(groupId, fileData);
                frames[fileId] = frame;
            } catch (Exception e) {
                e.printStackTrace();
            }
            if (fileId >= highestFileId) break;
        }
        return frames;
    }

    static boolean noAnimationInProgress(int frameId) {
        return frameId == -1;
    }
}

