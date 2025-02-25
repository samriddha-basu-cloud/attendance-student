import { useRef, useEffect, useState } from "react";
import jsQR from "jsqr";
import { db, updateDoc, setDoc } from "../utils/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScanLine, Camera, CheckCircle, ZoomIn, ZoomOut, Clock, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const Scanner = () => {
  const [qrData, setQrData] = useState(null);
  const [scanning, setScanning] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [entryTime, setEntryTime] = useState(null);
  const [exitTime, setExitTime] = useState(null);
  const [onBreak, setOnBreak] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState(null);
  const [breakEndTime, setBreakEndTime] = useState(null);
  const [alreadyExited, setAlreadyExited] = useState(false);
  const [takeBreak, setTakeBreak] = useState(false);
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
                  if (existingStudent.studentExitTime) {
                    setAlreadyExited(true);
                  } else if (onBreak) {
                    // End break
                    existingStudent.breakEndTime = scanResult.time;
                    setBreakEndTime(scanResult.time);
                    setOnBreak(false);
                  } else if (takeBreak) {
                    // Start break
                    setOnBreak(true);
                    setBreakStartTime(scanResult.time);
                  } else {
                    // Mark exit time
                    existingStudent.studentExitTime = scanResult.time;
                    setExitTime(scanResult.time);
                  }
                } else {
                  presentList.push(updatedEntry);
                  setEntryTime(scanResult.time);
                }

                updateDoc(attendanceRef, { Present: presentList });
              } else {
                // Create a new attendance document
                setDoc(attendanceRef, {
                  Date: formattedDate,
                  Day: day,
                  Present: [updatedEntry],
                });
                setEntryTime(scanResult.time);
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
  }, [student, scanning, takeBreak]);

  const resetScanner = () => {
    setQrData(null);
    setScanning(true);
    setZoomLevel(1);
    setEntryTime(null);
    setExitTime(null);
    setOnBreak(false);
    setBreakStartTime(null);
    setBreakEndTime(null);
    setAlreadyExited(false);
    setTakeBreak(false);
  };

  const formatTime = (timeString) => {
    const [hours, minutes] = timeString.split(":");
    return `${hours}:${minutes}`;
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

                {entryTime && !onBreak && !alreadyExited && (
                  <div className="w-full mb-2">
                    <h4 className="text-yellow-400 font-medium mb-1">Entry Time:</h4>
                    <div className="bg-gray-800 rounded-md p-3 text-sm">
                      <p className="text-gray-300">{formatTime(entryTime)}</p>
                    </div>
                  </div>
                )}

                {onBreak && (
                  <div className="w-full mb-2">
                    <h4 className="text-yellow-400 font-medium mb-1">Break Start Time:</h4>
                    <div className="bg-gray-800 rounded-md p-3 text-sm">
                      <p className="text-gray-300">{formatTime(breakStartTime)}</p>
                    </div>
                  </div>
                )}

                {breakEndTime && (
                  <div className="w-full mb-2">
                    <h4 className="text-yellow-400 font-medium mb-1">Break End Time:</h4>
                    <div className="bg-gray-800 rounded-md p-3 text-sm">
                      <p className="text-gray-300">{formatTime(breakEndTime)}</p>
                    </div>
                  </div>
                )}

                {exitTime && (
                  <div className="w-full mb-2">
                    <h4 className="text-yellow-400 font-medium mb-1">Exit Time:</h4>
                    <div className="bg-gray-800 rounded-md p-3 text-sm">
                      <p className="text-gray-300">{formatTime(exitTime)}</p>
                    </div>
                  </div>
                )}

                {alreadyExited && (
                  <div className="w-full mb-2">
                    <h4 className="text-red-400 font-medium mb-1">Already Exited:</h4>
                    <div className="bg-gray-800 rounded-md p-3 text-sm">
                      <p className="text-gray-300">You have already exited for today. See you tomorrow!</p>
                    </div>
                  </div>
                )}

                {!entryTime && !exitTime && !alreadyExited && (
                  <div className="w-full mb-2">
                    <h4 className="text-yellow-400 font-medium mb-1">Current Time:</h4>
                    <div className="bg-gray-800 rounded-md p-3 text-sm">
                      <p className="text-gray-300">{formatTime(new Date().toTimeString().split(" ")[0])}</p>
                    </div>
                    <p className="text-gray-300 mt-2">Scan the attendance QR to record your entry.</p>
                  </div>
                )}

                {entryTime && !onBreak && !alreadyExited && (
                  <div className="w-full mb-4">
                    <RadioGroup value={takeBreak ? "break" : "exit"} onValueChange={(value) => setTakeBreak(value === "break")}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="break" id="break" />
                        <Label htmlFor="break">Take Break</Label>
                        <RadioGroupItem value="exit" id="exit" />
                        <Label htmlFor="exit">Exit</Label>
                      </div>
                    </RadioGroup>
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
