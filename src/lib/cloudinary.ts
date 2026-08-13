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
  ensureConfig();

  const bytes = Buffer.from(await file.arrayBuffer());

  return new Promise<string>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "petflow/daily-logs",
          resource_type: "image",
          transformation: [
            { width: 1600, height: 1600, crop: "limit", quality: "auto" },
          ],
        },
        (error, result) => {
          if (error || !result?.secure_url) {
            reject(error ?? new Error("Falha no upload da foto."));
            return;
          }
          resolve(result.secure_url);
        },
      )
      .end(bytes);
  });
}
