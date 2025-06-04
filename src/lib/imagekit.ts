import Imagekit from "imagekit"

export const imagekit = new Imagekit({
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
})

export enum IMAGE_FOLDER {
  WORKSPACE_ICON = "/workspace-icon",
  PROJECT_ICON = "/project-icon",
}

export const uploadToImagekit = async (
  file: File,
  fileName: string,
  folder: IMAGE_FOLDER
) => {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const base64File = Buffer.from(arrayBuffer).toString("base64")

    const uploaded = await imagekit.upload({
      file: base64File,
      fileName,
      folder,
      checks: `"file.size" <= "1mb"`,
    })

    return uploaded
  } catch (error) {
    console.log("ERROR_UPLOAD")
    throw error
  }
}
