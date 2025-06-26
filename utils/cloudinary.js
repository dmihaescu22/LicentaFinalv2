export async function uploadToCloudinary(localUri) {
    console.log('[Cloudinary] Attempt upload, localUri:', localUri);

    const CLOUD_NAME = 'dludchtxw';
    const UPLOAD_PRESET = 'unsigned_preset';

    try {
        const response = await fetch(localUri);
        const blob = await response.blob();

        console.log('[Cloudinary] Blob created, size:', blob.size);

        const formData = new FormData();
        formData.append('file', {
            uri: localUri,
            type: 'image/jpeg',
            name: 'photo.jpg',
        });
        formData.append('upload_preset', UPLOAD_PRESET);

        console.log('[Cloudinary] FormData constructed:', formData);

        const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
        console.log('[Cloudinary] POST url:', url);

        const resp = await fetch(url, {
            method: 'POST',
            body: formData,
        });

        const responseText = await resp.text();
        console.log('[Cloudinary] Raw response:', responseText);

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (jsonErr) {
            throw new Error('Invalid JSON response: ' + responseText);
        }

        if (data.secure_url) {
            console.log('[Cloudinary] Upload success, secure_url:', data.secure_url);
            return data.secure_url;
        } else {
            console.error('[Cloudinary] Upload error:', data);
            throw new Error('Cloudinary upload error: ' + JSON.stringify(data));
        }
    } catch (err) {
        console.error('[Cloudinary] Exception:', err);
        throw err;
    }
} 