import type { Texture } from "three";

export type MaterialType = {
  material_name: string;
  model?: object;
  type?: string;
  icon?: string;
  texture?: string;
  threeTexture?: Texture;
};

export type VersionType = {
  url: string;
  type: string;
  id: string;
}

export type handleDataType = (file: ArrayBuffer | File) => Promise<void>;