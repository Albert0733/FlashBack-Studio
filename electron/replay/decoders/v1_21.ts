import { DecoderProfile, DecodedChunk, ChunkSection } from './DecoderProfile';
import { BufReader, skipNBT } from './buf';

// Hand-curated subset of MC 1.21.x block state IDs. Full table can be regenerated
// from Mojmap and bundled later without touching decoder logic.
const COMMON_BLOCKS_1_21: Record<number, string> = {
  0: 'minecraft:air', 1: 'minecraft:stone', 2: 'minecraft:granite', 3: 'minecraft:polished_granite',
  4: 'minecraft:diorite', 5: 'minecraft:polished_diorite', 6: 'minecraft:andesite', 7: 'minecraft:polished_andesite',
  8: 'minecraft:deepslate', 9: 'minecraft:cobbled_deepslate', 10: 'minecraft:polished_deepslate',
  11: 'minecraft:calcite', 12: 'minecraft:tuff', 13: 'minecraft:dripstone_block',
  14: 'minecraft:grass_block', 15: 'minecraft:dirt', 16: 'minecraft:coarse_dirt', 17: 'minecraft:podzol',
  18: 'minecraft:rooted_dirt', 19: 'minecraft:mud', 20: 'minecraft:cobblestone',
  21: 'minecraft:oak_planks', 22: 'minecraft:spruce_planks', 23: 'minecraft:birch_planks',
  24: 'minecraft:jungle_planks', 25: 'minecraft:acacia_planks', 26: 'minecraft:dark_oak_planks',
  27: 'minecraft:oak_log', 28: 'minecraft:spruce_log', 29: 'minecraft:birch_log',
  30: 'minecraft:oak_leaves', 31: 'minecraft:spruce_leaves', 32: 'minecraft:birch_leaves',
  33: 'minecraft:sand', 34: 'minecraft:red_sand', 35: 'minecraft:gravel',
  36: 'minecraft:oak_stairs', 37: 'minecraft:cobblestone_stairs', 38: 'minecraft:glass',
  39: 'minecraft:white_wool', 40: 'minecraft:orange_wool', 41: 'minecraft:magenta_wool',
  42: 'minecraft:light_blue_wool', 43: 'minecraft:yellow_wool', 44: 'minecraft:lime_wool',
  45: 'minecraft:pink_wool', 46: 'minecraft:gray_wool', 47: 'minecraft:light_gray_wool',
  48: 'minecraft:cyan_wool', 49: 'minecraft:purple_wool', 50: 'minecraft:blue_wool',
  51: 'minecraft:brown_wool', 52: 'minecraft:green_wool', 53: 'minecraft:red_wool', 54: 'minecraft:black_wool',
  59: 'minecraft:water', 60: 'minecraft:lava', 61: 'minecraft:bedrock', 62: 'minecraft:sandstone',
  63: 'minecraft:red_sandstone', 68: 'minecraft:stone_bricks', 69: 'minecraft:mossy_cobblestone',
  79: 'minecraft:snow_block', 81: 'minecraft:clay', 86: 'minecraft:chest', 87: 'minecraft:crafting_table',
  90: 'minecraft:diamond_block', 91: 'minecraft:gold_block', 92: 'minecraft:iron_block',
  93: 'minecraft:netherrack', 94: 'minecraft:nether_bricks', 97: 'minecraft:end_stone',
  122: 'minecraft:packed_ice', 123: 'minecraft:blue_ice', 124: 'minecraft:basalt',
  129: 'minecraft:netherite_block', 143: 'minecraft:blackstone', 144: 'minecraft:polished_blackstone',
  152: 'minecraft:amethyst_block', 165: 'minecraft:sculk', 169: 'minecraft:copper_block',
};

export class MC1_21Decoder implements DecoderProfile {
  dataVersionMin = 4081;
  dataVersionMax = 4700;
  versionLabel = 'MC 1.21.x';
  worldHeight = 384;
  minY = -64;
  sectionsPerChunk = 24;

  stateName(stateId: number): string {
    return COMMON_BLOCKS_1_21[stateId] || 'minecraft:unknown';
  }

  decodeChunkPacket(buf: Buffer): DecodedChunk | null {
    try {
      const r = new BufReader(buf);
      r.readVarInt(); // packet id
      const chunkX = r.readVarInt();
      const chunkZ = r.readVarInt();
      skipNBT(r); // heightmaps
      const dataLen = r.readVarInt();
      const dataEnd = r.pos + dataLen;
      const sections: ChunkSection[] = [];
      for (let sy = 0; sy < this.sectionsPerChunk; sy++) {
        const blockCount = r.readShort();
        const bitsPerBlock = r.readVarInt();
        let palette: number[];
        if (bitsPerBlock === 0) { palette = [r.readVarInt()]; }
        else if (bitsPerBlock <= 8) {
          const n = r.readVarInt(); palette = [];
          for (let i = 0; i < n; i++) palette.push(r.readVarInt());
        } else { palette = []; }
        const dataLen2 = r.readVarInt();
        const longs: bigint[] = [];
        for (let i = 0; i < dataLen2; i++) longs.push(r.readLong());
        if (blockCount === 0) continue;
        const blocks = new Int32Array(4096);
        const blocksPerLong = Math.floor(64 / bitsPerBlock);
        const mask = (1n << BigInt(bitsPerBlock)) - 1n;
        let idx = 0;
        for (let li = 0; li < longs.length && idx < 4096; li++) {
          let lv = longs[li];
          for (let j = 0; j < blocksPerLong && idx < 4096; j++) {
            const raw = Number(lv & mask); lv >>= BigInt(bitsPerBlock);
            blocks[idx++] = bitsPerBlock >= 9 ? raw : (palette[raw] ?? 0);
          }
        }
        sections.push({ blocks, blockCount, sectionY: sy });
      }
      return { chunkX, chunkZ, sections };
    } catch { return null; }
  }
}

export const mc1_21 = new MC1_21Decoder();
