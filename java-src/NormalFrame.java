/*
 * Decompiled with CFR 0.153-SNAPSHOT (d6f6758-dirty).
 */
package com.hazy.cache.anim;

import com.hazy.io.Buffer;

public final class NormalFrame implements SeqFrame {
    private boolean hasAlphaTransform;
    public int defaultFrameLength;
    public final FrameBase frameBase;
    public int translatorCount;
    public int[] indexFrameIds;
    public int[] translatorX;
    public int[] translatorY;
    public int[] translatorZ;

    public NormalFrame(int groupId, byte[] bytes) {
        int i;
        Buffer in = new Buffer(bytes);
        int framemapArchiveIndex = in.readUnsignedShort();
        int length = in.readUnsignedByte();
        this.frameBase = FrameBase.frameBases[framemapArchiveIndex];
        Buffer data2 = new Buffer(bytes);
        data2.pos = length + in.pos;
        int[] types = this.frameBase.getTypes();
        int[] indexFrameIds = new int[500];
        int[] scratchTranslatorX = new int[500];
        int[] scratchTranslatorY = new int[500];
        int[] scratchTranslatorZ = new int[500];
        int lastI = -1;
        int index = 0;
        for (i = 0; i < length; ++i) {
            int attribute = in.readUnsignedByte();
            if (attribute <= 0) continue;
            int type2 = types[i];
            if (type2 != 0) {
                for (int j = i - 1; j > lastI; --j) {
                    if (types[j] != 0) continue;
                    indexFrameIds[index] = j;
                    scratchTranslatorX[index] = 0;
                    scratchTranslatorY[index] = 0;
                    scratchTranslatorZ[index] = 0;
                    ++index;
                    break;
                }
            }
            indexFrameIds[index] = i;
            int defaultValue = type2 == 3 ? 128 : 0;
            scratchTranslatorX[index] = (attribute & 1) == 0 ? defaultValue : data2.readSignedSmart();
            scratchTranslatorY[index] = (attribute & 2) == 0 ? defaultValue : data2.readSignedSmart();
            int n = scratchTranslatorZ[index] = (attribute & 4) == 0 ? defaultValue : data2.readSignedSmart();
            if (type2 == 5) {
                this.hasAlphaTransform = true;
            }
            lastI = i;
            ++index;
        }
        if (data2.pos != bytes.length) {
            throw new IllegalStateException("[groupId=" + groupId + ", framemapArchiveIndex=" + framemapArchiveIndex + "] mismatch for frame, length=" + length + ", index=" + index);
        }
        this.translatorCount = index;
        this.indexFrameIds = new int[index];
        this.translatorX = new int[index];
        this.translatorY = new int[index];
        this.translatorZ = new int[index];
        for (i = 0; i < index; ++i) {
            this.indexFrameIds[i] = indexFrameIds[i];
            this.translatorX[i] = scratchTranslatorX[i];
            this.translatorY[i] = scratchTranslatorY[i];
            this.translatorZ[i] = scratchTranslatorZ[i];
        }
    }

    @Override
    public FrameBase getFrameBase() {
        return this.frameBase;
    }

    @Override
    public boolean noAnimationInProgress() {
        return this.hasAlphaTransform;
    }



    public int getTransformCount() {
        return this.translatorCount;
    }


    public int[] getTransformTypes() {
        return this.indexFrameIds;
    }


    public int[] getTranslatorX() {
        return this.translatorX;
    }


    public int[] getTranslatorY() {
        return this.translatorY;
    }


    public int[] getTranslatorZ() {
        return this.translatorZ;
    }


    public boolean isShowing() {
        return this.hasAlphaTransform;
    }
}

