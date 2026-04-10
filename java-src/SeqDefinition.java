package com.hazy.cache.anim;

import com.hazy.cache.Archive;
import com.hazy.cache.skeletal.SkeletalFrame;
import com.hazy.collection.Cacheable;
import com.hazy.io.Buffer;
import com.hazy.util.FileUtils;
import it.unimi.dsi.fastutil.ints.Int2IntMap;
import lombok.Data;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.util.Arrays;

@Slf4j
@Data
public final class SeqDefinition extends Cacheable {

    public static SeqDefinition[] animations;
    public int frameCount;
    public final int animId;
    public int modelId;
    public int[] primaryFrameIds;
    public int[] frameModelIds;
    public int[] secondaryFrames;
    public int[] delays;
    public int[] interleaveOrder;
    @Getter
    public int frameStep;
    public boolean stretches;
    public boolean isEmpty;
    public int forcedPriority;
    public int leftHandItem;
    public int rightHandItem;
    public int resetCycle;
    public boolean shouldResetCycle;
    public int moveStyle;
    public int idleStyle;
    public int delayType;
    private int skeletalRangeBegin;
    private int skeletalRangeEnd;
    @Getter
    private int skeletalId = -1;
    @Getter
    private boolean[] masks = new boolean[256];
    public Int2IntMap skeletalSounds;

    public static void init(Archive streamLoader) throws IOException {
        byte[] rawData = streamLoader.get("seq.dat");
        byte[] uncompressedData = FileUtils.gZipDecompress(rawData);
        Buffer buffer = new Buffer(uncompressedData);
        int highestFileId = buffer.readUnsignedShort();
        SeqDefinition[] animations = SeqDefinition.animations;
        if (animations == null) {
            animations = SeqDefinition.animations = new SeqDefinition[highestFileId + 1 + 5000];
        }
        for (int i = 0; i <= highestFileId; ++i) {
            int id = buffer.readUnsignedShort();
            int animLength = buffer.readUnsignedShort();
            byte[] animData = buffer.readBytes(animLength);
            SeqDefinition animation = animations[id];
            if (animation == null) {
                animation = animations[id] = new SeqDefinition(id);
            }
            animation.readValues(new Buffer(animData), id);
            animation.postDecode();
            SeqDefinition.customAnimations(id);
            if (id >= highestFileId) break;
        }

        log.info("Loaded: {} Animations", (Object)highestFileId);
    }

    private static void customAnimations(int id) {
        if (id == 3186) {
            SeqDefinition.animations[id].forcedPriority = 6;
            SeqDefinition.animations[id].moveStyle = 2;
            SeqDefinition.animations[id].idleStyle = 2;
            SeqDefinition.animations[id].resetCycle = 1;
            for (int a = 0; a < SeqDefinition.animations[id].delays.length; ++a) {
                if (SeqDefinition.animations[id].delays[a] != 9) continue;
                SeqDefinition.animations[id].delays[a] = 25;
            }
        }
    }

    public int duration(int i) {
        SeqFrame frame;
        if (i > this.delays.length) {
            return 1;
        }
        int j = 0;
        try {
            j = this.delays[i];
        } catch (Exception e) {
            e.printStackTrace();
            return 1;
        }
        if (j == 0 && (frame = SeqFrame.getFrame(this.primaryFrameIds[i])) instanceof NormalFrame) {
            j = this.delays[i] = ((NormalFrame)frame).defaultFrameLength;
        }
        if (j == 0) {
            j = 1;
        }
        return j;
    }

    public boolean areFramesEmpty() {
        return this.primaryFrameIds == null;
    }

    public static SeqDefinition get(int id) {
        return animations[id];
    }

    private void readValues(Buffer buffer, int animId) {
        int opcode;
        int lastOpcode = -1;
        while ((opcode = buffer.readUnsignedByte()) != 0) {
            if (opcode == 1) {
                int i;
                this.frameCount = buffer.readUnsignedShort();
                this.primaryFrameIds = new int[this.frameCount];
                this.secondaryFrames = new int[this.frameCount];
                this.delays = new int[this.frameCount];
                this.frameModelIds = new int[this.frameCount];
                for (i = 0; i < this.frameCount; ++i) {
                    this.delays[i] = buffer.readUnsignedShort();
                }
                for (i = 0; i < this.frameCount; ++i) {
                    this.primaryFrameIds[i] = buffer.readUnsignedShort();
                    this.secondaryFrames[i] = -1;
                }
                i = 0;
                while (i < this.frameCount) {
                    int frameBase = buffer.readUnsignedShort();
                    int n = i;
                    this.frameModelIds[n] = this.frameModelIds[n] + frameBase;
                    int n2 = i++;
                    this.primaryFrameIds[n2] = this.primaryFrameIds[n2] + (frameBase << 16);
                }
            } else if (opcode == 2) {
                this.frameStep = buffer.readUnsignedShort();
            } else if (opcode == 3) {
                int len = buffer.readUnsignedByte();
                this.interleaveOrder = new int[len + 1];
                int[] interleaveOrder = this.interleaveOrder;
                boolean[] masks = this.masks;
                for (int i = 0; i < len; ++i) {
                    int mask;
                    interleaveOrder[i] = mask = buffer.readUnsignedByte();
                    masks[mask] = true;
                }
                interleaveOrder[len] = 9999999;
            } else if (opcode == 4) {
                this.stretches = true;
            } else if (opcode == 5) {
                this.forcedPriority = buffer.readUnsignedByte();
            } else if (opcode == 6) {
                this.leftHandItem = buffer.readUnsignedShort();
            } else if (opcode == 7) {
                this.rightHandItem = buffer.readUnsignedShort();
            } else if (opcode == 8) {
                this.resetCycle = buffer.readUnsignedByte();
                this.shouldResetCycle = true;
            } else if (opcode == 9) {
                this.moveStyle = buffer.readUnsignedByte();
            } else if (opcode == 10) {
                this.idleStyle = buffer.readUnsignedByte();
            } else if (opcode == 11) {
                this.delayType = buffer.readUnsignedByte();
            } else if (opcode == 12) {
                int i;
                int len = buffer.readUnsignedByte();
                for (i = 0; i < len; ++i) {
                    buffer.readUnsignedShort();
                }
                for (i = 0; i < len; ++i) {
                    buffer.readUnsignedShort();
                }
            } else if (opcode == 13) {
                int len = buffer.readUnsignedByte();
                for (int i = 0; i < len; ++i) {
                    buffer.readUShort();
                    buffer.readUnsignedByte();
                    buffer.readUnsignedByte();
                    buffer.readUnsignedByte();
                }
            } else if (opcode == 14) {
                int skeletalId = this.skeletalId = buffer.readInt();
                SkeletalFrame.skeletalFrameIds.add(skeletalId >>> 16);
            } else if (opcode == 15) {
                int count = buffer.readUnsignedShort();
                for (int index = 0; index < count; ++index) {
                    buffer.readUnsignedShort();
                    buffer.readUShort();
                    buffer.readUnsignedByte();
                    buffer.readUnsignedByte();
                    buffer.readUnsignedByte();
                }
            } else if (opcode == 16) {
                this.skeletalRangeBegin = buffer.readUnsignedShort();
                this.skeletalRangeEnd = buffer.readUnsignedShort();
            } else if (opcode == 17) {
                this.masks = new boolean[256];
                boolean[] masks = this.masks;
                Arrays.fill(masks, false);
                int len = buffer.readUnsignedByte();
                for (int i = 0; i < len; ++i) {
                    masks[buffer.readUnsignedByte()] = true;
                }
            } else {
                throw new IllegalStateException("Error unrecognised seq config code: " + opcode + ", last opcode: " + lastOpcode);
            }
            lastOpcode = opcode;
        }
        if (this.frameCount == 0) {
            this.frameCount = 1;
            this.primaryFrameIds = new int[]{-1};
            this.secondaryFrames = new int[]{-1};
            this.delays = new int[]{-1};
            this.isEmpty = true;
        }
        if (this.moveStyle == -1) {
            int n = this.moveStyle = this.interleaveOrder == null ? 0 : 2;
        }
        if (this.idleStyle == -1) {
            int n = this.idleStyle = this.interleaveOrder == null ? 0 : 2;
        }
        if (animId == 6600) {
            this.delayType = 2;
        }
        if (animId == 9168) {
            this.delayType = 2;
            this.moveStyle = 0;
            this.idleStyle = 0;
        }
        if (animId == 9162) {
            this.moveStyle = 1;
            this.idleStyle = 1;
        }
        switch (animId) {
            case 4117: {
                this.delays = new int[]{500, 500, 400, 400, 400, 400, 6, 8, 8};
                break;
            }
            case 4103: {
                this.delays = new int[]{5, 4, 4, 4, 4, 2, 2, 5};
                break;
            }
            case 7471: {
                this.delays = new int[]{3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0};
            }
        }
    }

    private SeqDefinition(int animId) {
        this.animId = animId;
        this.frameStep = -1;
        this.skeletalId = -1;
        this.stretches = false;
        this.forcedPriority = 5;
        this.leftHandItem = -1;
        this.rightHandItem = -1;
        this.resetCycle = 99;
        this.moveStyle = -1;
        this.idleStyle = -1;
        this.delayType = 1;
    }

    public void postDecode() {
        if (moveStyle == -1) {
            if (masks == null && masks == null) {
                moveStyle = 0;
            } else {
                moveStyle = 2;
            }
        }

        if (idleStyle == -1) {
            if (masks == null && masks == null) {
                idleStyle = 0;
            } else {
                idleStyle = 2;
            }
        }
    }


    public boolean isSkeletalAnimation() {
        return this.skeletalId >= 0;
    }

    public int getSkeletalLength() {
        return this.skeletalRangeEnd - this.skeletalRangeBegin;
    }

}

