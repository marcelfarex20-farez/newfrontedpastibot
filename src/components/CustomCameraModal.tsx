import React, { useRef, useState, useEffect } from 'react';
import { IonModal, IonIcon, IonSpinner } from '@ionic/react';
import { closeOutline, refreshOutline, banOutline } from 'ionicons/icons';
import './CustomCameraModal.css';

interface CustomCameraModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (base64: string) => void;
}

const CustomCameraModal: React.FC<CustomCameraModalProps> = ({ isOpen, onClose, onCapture }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && !capturedImage) {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [isOpen, facingMode, capturedImage]);

    const startCamera = async () => {
        setIsReady(false);
        setError(null);
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1080 },
                    height: { ideal: 1080 }
                }
            });
            setStream(newStream);
            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
            }
            setIsReady(true);
        } catch (err) {
            console.error("Error accessing camera:", err);
            setError("No se pudo acceder a la cámara. Verifica los permisos.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const toggleCamera = () => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (context) {
            // Usar un tamaño cuadrado para el perfil
            const size = Math.min(video.videoWidth, video.videoHeight);
            canvas.width = size;
            canvas.height = size;

            const startX = (video.videoWidth - size) / 2;
            const startY = (video.videoHeight - size) / 2;

            // Si es la cámara frontal, reflejamos el canvas para que coincida con la preview
            if (facingMode === 'user') {
                context.translate(size, 0);
                context.scale(-1, 1);
            }

            context.drawImage(video, startX, startY, size, size, 0, 0, size, size);

            const base64 = canvas.toDataURL('image/jpeg', 0.8);
            setCapturedImage(base64);
            stopCamera();
        }
    };

    const handleUsePhoto = () => {
        if (capturedImage) {
            onCapture(capturedImage);
            handleClose();
        }
    };

    const handleRetake = () => {
        setCapturedImage(null);
    };

    const handleClose = () => {
        setCapturedImage(null);
        stopCamera();
        onClose();
    };

    return (
        <IonModal isOpen={isOpen} onDidDismiss={handleClose} className="camera-modal">
            <div className="camera-modal-wrapper">
                <div className="camera-modal-header">
                    <div className="header-text-group">
                        <p className="camera-modal-title">Captura de Imagen</p>
                        <h2 className="camera-modal-subtitle">El momento <span>perfecto</span></h2>
                    </div>
                    <button className="close-modal-btn" onClick={handleClose}>
                        <IonIcon icon={closeOutline} />
                    </button>
                </div>

                <div className="camera-view-container">
                    {!capturedImage ? (
                        <>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`preview-video ${facingMode === 'environment' ? 'back-camera' : ''}`}
                            />

                            <div className="camera-frame-overlay">
                                <div className="focus-corner top-left"></div>
                                <div className="focus-corner top-right"></div>
                                <div className="focus-corner bottom-left"></div>
                                <div className="focus-corner bottom-right"></div>

                                {!isReady && !error && (
                                    <div className="loader-overlay">
                                        <IonSpinner name="crescent" color="warning" />
                                    </div>
                                )}

                                {error && (
                                    <div className="no-access-msg">
                                        <IonIcon icon={banOutline} />
                                        <p>{error}</p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="captured-preview-overlay">
                            <img src={capturedImage} alt="Captured" className="captured-img" />
                            <div className="confirm-actions">
                                <button className="retake-btn" onClick={handleRetake}>Repetir</button>
                                <button className="use-photo-btn" onClick={handleUsePhoto}>Usar Foto</button>
                            </div>
                        </div>
                    )}
                </div>

                {!capturedImage && (
                    <div className="camera-controls-footer">
                        <button className="flip-btn" onClick={toggleCamera}>
                            <IonIcon icon={refreshOutline} />
                        </button>
                        <div className="shutter-btn-wrapper" onClick={capturePhoto}>
                            <div className="shutter-inner"></div>
                        </div>
                        <div style={{ width: '50px' }}></div> {/* Spacer for symmetry */}
                    </div>
                )}

                <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
        </IonModal>
    );
};

export default CustomCameraModal;
