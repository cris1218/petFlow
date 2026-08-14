import { v2 as cloudinary } from "cloudinary";

function configured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

export function isCloudinaryConfigured() {
  return configured();
}

function ensureConfig() {
  if (!configured()) {
    throw new Error(
      "Cloudinary não configurado. Defina CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET.",
    );
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export async function uploadDailyLogPhoto(file: File) {
  return uploadImage(file, {
    folder: "petflow/daily-logs",
    transformation: [
      { width: 1600, height: 1600, crop: "limit", quality: "auto" },
    ],
  });
}

export async function uploadHotelLogo(file: File, tenantId: string) {
  return uploadImage(file, {
    folder: "petflow/logos",
    public_id: tenantId,
    overwrite: true,
    invalidate: true,
    transformation: [
      { width: 800, height: 800, crop: "limit", quality: "auto" },
    ],
  });
}

export async function deleteHotelLogo(tenantId: string) {
  if (!configured()) return;
  ensureConfig();
  await cloudinary.uploader.destroy(`petflow/logos/${tenantId}`);
}

async function uploadImage(
  file: File,
  options: {
    folder: string;
    public_id?: string;
    overwrite?: boolean;
    invalidate?: boolean;
    transformation: Array<Record<string, unknown>>;
  },
) {
  ensureConfig();

  const bytes = Buffer.from(await file.arrayBuffer());

  return new Promise<string>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: options.folder,
          public_id: options.public_id,
          overwrite: options.overwrite,
          invalidate: options.invalidate,
          resource_type: "image",
          transformation: options.transformation,
        },
        (error, result) => {
          if (error || !result?.secure_url) {
            reject(error ?? new Error("Falha no upload da imagem."));
            return;
          }
          resolve(result.secure_url);
        },
      )
      .end(bytes);
  });
}
