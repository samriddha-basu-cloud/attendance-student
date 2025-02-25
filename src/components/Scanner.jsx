import { useRef, useEffect, useState } from "react";
import jsQR from "jsqr";
import { db, updateDoc, setDoc } from "../utils/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScanLine, Camera, CheckCircle, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const Scanner = () => {
  const [qrData, setQrData] = useState(null);
  const [scanning, setScanning] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Retrieve student information from local storage
  const student = JSON.parse(localStorage.getItem("student")) || null;

  const handleZoomChange = async (value) => {
    setZoomLevel(value[0]);
    
    // Apply zoom if supported
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      try {
        const capabilities = videoTrack.getCapabilities();
        // Check if zoom is supported
        if (capabilities.zoom) {
          const zoom = capabilities.zoom.min + (capabilities.zoom.max - capabilities.zoom.min) * (value[0] - 1) / 2;
          await videoTrack.applyConstraints({ advanced: [{ zoom }] });
        }
      } catch {
        console.log("Zoom not supported in this device");
      }
    }
  };

  useEffect(() => {
    let animationFrameId = null;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise((resolve) => videoRef.current.onloadedmetadata = resolve);
          videoRef.current.play();
          animationFrameId = requestAnimationFrame(tick);
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
      }
    };

    const tick = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          try {
            const scanResult = JSON.parse(code.data);
            setQrData(scanResult);
            setScanning(false);

            if (!student) return;

            const today = new Date();
            const formattedDate = today.toLocaleDateString("en-GB"); // dd/mm/yyyy
            const day = today.toLocaleDateString("en-GB", { weekday: "long" });

            const attendanceRef = doc(db, "attendance", formattedDate);

            // Check if attendance document exists
            getDoc(attendanceRef).then((attendanceSnap) => {
              let updatedEntry = {
                studentName: student.name,
                studentRoll: student.roll,
                studentEntryTime: scanResult.time,
              };

              if (attendanceSnap.exists()) {
                const attendanceData = attendanceSnap.data();
                const presentList = attendanceData.Present || [];

                const existingStudent = presentList.find(
                  (s) => s.studentRoll === student.roll
                );

                if (existingStudent) {
                  existingStudent.studentExitTime = scanResult.time;
                } else {
                  presentList.push(updatedEntry);
                }

                updateDoc(attendanceRef, { Present: presentList });
              } else {
                // Create a new attendance document
                setDoc(attendanceRef, {
                  Date: formattedDate,
                  Day: day,
                  Present: [updatedEntry],
                });
              }
            });
          } catch (error) {
            console.error("Error processing QR Code:", error);
          }
        }
      }
      
      if (scanning) {
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    if (scanning) {
      startCamera();
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [student, scanning]);

  const resetScanner = () => {
    setQrData(null);
    setScanning(true);
    setZoomLevel(1);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-black border-b border-yellow-500/30 py-4 px-6 shadow-md shadow-yellow-500/10">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold text-yellow-400 text-center">QR Scanner</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-6 px-4 pb-20">
        <Card className="bg-black border-yellow-500/50 border text-white shadow-lg shadow-yellow-500/10 max-w-xl mx-auto">
          <CardHeader className="border-b border-yellow-500/30">
            <CardTitle className="text-xl font-bold text-yellow-400 flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {scanning ? "Scanning QR Code" : "Scan Complete"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 relative">
            {scanning ? (
              <div className="flex flex-col">
                {/* Camera View */}
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  <div className="absolute inset-0 border-4 border-yellow-400/30 rounded-lg"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-56 h-56 border-2 border-yellow-400 rounded-lg relative">
                      <div className="absolute top-0 h-0.5 w-full bg-yellow-400 animate-scanline"></div>
                    </div>
                  </div>
                  <div className="absolute top-4 left-4 right-4 bg-black/70 rounded-md p-2 text-sm text-center text-yellow-300">
                    <ScanLine className="inline h-4 w-4 mr-1 animate-pulse" />
                    Position QR code within the frame
                  </div>
                </div>
                
                {/* Zoom Controls */}
                <div className="bg-gray-800 p-4">
                  <div className="flex items-center gap-4">
                    <ZoomOut className="h-5 w-5 text-yellow-400" />
                    <Slider
                      value={[zoomLevel]}
                      min={1}
                      max={3}
                      step={0.1}
                      onValueChange={handleZoomChange}
                      className="flex-1"
                    />
                    <ZoomIn className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="text-center mt-1 text-xs text-gray-400">
                    Zoom Level: {zoomLevel.toFixed(1)}x
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 flex flex-col items-center">
                <div className="bg-green-500/20 p-4 rounded-full mb-4">
                  <CheckCircle className="h-16 w-16 text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-green-400 mb-1">Scan Successful</h3>
                <p className="text-gray-300 mb-4 text-center">
                  {student ? "Attendance recorded successfully!" : "QR code detected"}
                </p>
                
                {qrData && (
                  <div className="w-full mb-4">
                    <h4 className="text-yellow-400 font-medium mb-2">Scan Details:</h4>
                    <div className="bg-gray-800 rounded-md p-3 text-sm overflow-x-auto max-h-40">
                      <pre className="text-gray-300 whitespace-pre-wrap">{JSON.stringify(qrData, null, 2)}</pre>
                    </div>
                  </div>
                )}
                
                <Button 
                  onClick={resetScanner} 
                  className="mt-4 bg-yellow-500 hover:bg-yellow-600 text-black"
                >
                  Scan Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Footer */}
      <footer className="bg-black border-t border-yellow-500/30 py-3 fixed bottom-0 w-full">
        <div className="container mx-auto px-4 text-center text-gray-400 text-sm">
          <p>© 2025 Student Management System. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Scanner;