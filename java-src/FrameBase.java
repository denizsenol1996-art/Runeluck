package com.hazy.cache.anim;

import com.hazy.cache.Archive;
import com.hazy.cache.skeletal.AnimationBoneWrapper;
import com.hazy.collection.Cacheable;
import com.hazy.io.Buffer;
import com.hazy.util.FileUtils;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.extern.slf4j.Slf4j;
import net.runelite.api.Skeleton;
import net.runelite.rs.api.RSNode;

import java.io.IOException;

@Data
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Slf4j
public final class FrameBase extends Cacheable implements Skeleton {
    public final int id;
    public final int[] types;
    public final int[][] frameMaps;
    public final int length;
    public final AnimationBoneWrapper animationBoneWrapper;
    public static final FrameBase[] frameBases = new FrameBase[32768];

    public FrameBase(int id, Buffer buffer) {
        int i;
        this.id = id;
        int length = this.length = buffer.readUnsignedByte();
        this.types = new int[length];
        int[] types = this.types;
        int[][] nArrayArray = new int[length][];
        this.frameMaps = nArrayArray;
        int[][] frameMaps = nArrayArray;
        for (i = 0; i < length; ++i) {
            types[i] = buffer.readUnsignedByte();
        }
        for (i = 0; i < length; ++i) {
            frameMaps[i] = new int[buffer.readUnsignedByte()];
        }
        for (i = 0; i < length; ++i) {
            int[] frameMap = frameMaps[i];
            for (int j = 0; j < frameMap.length; ++j) {
                frameMap[j] = buffer.readUnsignedByte();
            }
        }
        this.animationBoneWrapper = FrameBase.loadABW(buffer);
    }

    private static AnimationBoneWrapper loadABW(Buffer in) {
        if (in.pos < in.payload.length) {
            int abwLength = in.readUnsignedShort();
            return abwLength > 0 ? new AnimationBoneWrapper(in, abwLength) : null;
        }
        return null;
    }


    public AnimationBoneWrapper getAbw() {
        return this.animationBoneWrapper;
    }

    @Override
    public int getCount() {
        return this.length;
    }

    @Override
    public int[] getTypes() {
        return this.types;
    }

    @Override
    public int[][] getList() {
        return this.frameMaps;
    }

    public static void loadFrameBases(Archive streamLoader) throws IOException {
        byte[] rawData = streamLoader.get("framebases.dat");
        byte[] uncompressedData = FileUtils.gZipDecompress(rawData);
        Buffer stream = new Buffer(uncompressedData);
        int count = stream.readUnsignedShort();

        System.out.println("max frame base: " + count);
        for (int i = 0; i < count; ++i) {
            int fileId = stream.readUnsignedShort();
            int fileSize = stream.readUnsignedShort();
            byte[] fileData = stream.readBytes(fileSize);
            Buffer fileBuffer = new Buffer(fileData);
            FrameBase.frameBases[fileId] = new FrameBase(fileId, fileBuffer);
        }
        log.info("FrameBase count {} loaded!", (Object)count);
    }

    @Override
    public RSNode getNext() {
        return null;
    }

    @Override
    public RSNode getPrevious() {
        return null;
    }

    @Override
    public void unlink() {

    }

    @Override
    public long getHash() {
        return 0;
    }
}

