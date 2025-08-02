// Function to compress image with target size limit
export const compressImage = async (
  file: File,
  maxSizeInMB = 2,
  initialQuality = 0.8,
): Promise<File> => {
  // Convert MB to bytes
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024

  // Skip compression for small files that are already under the limit
  if (file.size <= maxSizeInBytes) {
    console.log("File already under size limit, skipping compression")
    return file
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)

    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string

      img.onload = async () => {
        let quality = initialQuality
        let compressedFile: File | null = null
        let attempt = 1

        // Start with original dimensions
        let maxWidth = img.width

        // If the image is very large, scale it down first
        if (maxWidth > 2048) {
          maxWidth = 2048
        }

        // Keep trying with reduced quality until size is under limit
        while (attempt <= 10) {
          const canvas = document.createElement("canvas")

          // Calculate dimensions (maintaining aspect ratio)
          const ratio = maxWidth / img.width
          const width = maxWidth
          const height = img.height * ratio

          canvas.width = width
          canvas.height = height

          // Draw image
          const ctx = canvas.getContext("2d")
          ctx?.drawImage(img, 0, 0, width, height)

          // Get blob with current quality
          const blob = await new Promise<Blob | null>((blobResolve) => {
            canvas.toBlob(
              (result) => blobResolve(result),
              "image/jpeg",
              quality,
            )
          })

          if (!blob) {
            attempt++
            quality -= 0.1
            continue
          }

          // Create file from blob
          compressedFile = new File(
            [blob],
            file.name.replace(/\.[^/.]+$/, "") + ".jpg", // Convert to jpg
            {
              type: "image/jpeg",
              lastModified: Date.now(),
            },
          )

          console.log(
            `Attempt ${attempt}: Quality ${quality.toFixed(2)}, Size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`,
          )

          // Check if size is now under the limit
          if (compressedFile.size <= maxSizeInBytes) {
            break
          }

          // If still too large, reduce quality and try again
          // First few attempts, reduce quality
          if (attempt <= 5) {
            quality -= 0.1
          }
          // Later attempts, also reduce dimensions
          else {
            quality -= 0.05
            maxWidth = maxWidth * 0.8
          }

          attempt++
        }

        if (compressedFile && compressedFile.size <= maxSizeInBytes) {
          console.log(
            `Compression successful: ${(file.size / 1024 / 1024).toFixed(2)} MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`,
          )
          resolve(compressedFile)
        } else if (compressedFile) {
          console.warn(
            `Could not compress below target size. Best result: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`,
          )
          resolve(compressedFile) // Return best effort
        } else {
          reject(new Error("Compression failed completely"))
        }
      }

      img.onerror = (error) => {
        reject(error)
      }
    }

    reader.onerror = (error) => {
      reject(error)
    }
  })
}
