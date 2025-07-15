import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { SWATCHES } from '@/constants';
import { Paintbrush, RefreshCw, Play } from 'lucide-react';
import { toast, Toaster } from 'sonner';

interface GeneratedResult {
    expression: string;
    answer: string;
}


const API_URL = import.meta.env.VITE_API_URL;

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('rgb(255, 255, 255)');
    const [reset, setReset] = useState(false);
    const [dictOfVars, setDictOfVars] = useState({});
    const [result, setResult] = useState<GeneratedResult>();
    const [latexExpression, setLatexExpression] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (latexExpression && window.MathJax) {
            setTimeout(() => {
                window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
            }, 0);
        }
    }, [latexExpression]);

    useEffect(() => {
        if (result) {
            renderLatexToCanvas(result.expression, result.answer);
        }
    }, [result]);

    useEffect(() => {
        if (reset) {
            resetCanvas();
            setLatexExpression(null);
            setResult(undefined);
            setDictOfVars({});
            setReset(false);
        }
    }, [reset]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight - canvas.offsetTop;
                ctx.lineCap = 'round';
                ctx.lineWidth = 3;
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML';
        script.async = true;
        document.head.appendChild(script);

        script.onload = () => {
            window.MathJax.Hub.Config({
                tex2jax: { inlineMath: [['$', '$'], ['\\(', '\\)']] },
            });
        };

        return () => {
            document.head.removeChild(script);
        };
    }, []);

    const renderLatexToCanvas = (expression: string, answer: string) => {
        // For simple math expressions, use LaTeX
        const isSimpleMath = answer.toString().length < 20 && !answer.toString().includes(' ');
        
        if (isSimpleMath) {
            const latex = `\\(\\LARGE{${expression} = ${answer}}\\)`;
            setLatexExpression(latex);
        } else {
            // For complex answers, we'll display them in the UI below
            setLatexExpression(null);
        }
        
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const resetCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const getCanvasRelativeCoords = (
        e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
    ) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        
        // Get the bounding rectangle of the canvas
        const rect = canvas.getBoundingClientRect();
        
        // Get canvas actual dimensions
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        
        // Get canvas display dimensions
        const displayWidth = rect.width;
        const displayHeight = rect.height;
        
        // Calculate scale factors
        const scaleX = canvasWidth / displayWidth;
        const scaleY = canvasHeight / displayHeight;

        let clientX: number, clientY: number;

        if ('touches' in e) {
            // Handle touch events
            const touch = e.touches[0] || e.changedTouches[0];
            clientX = touch.clientX;
            clientY = touch.clientY;
        } else {
            // Handle mouse events
            clientX = e.clientX;
            clientY = e.clientY;
        }

        // Calculate coordinates relative to canvas, accounting for scale
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        return { x, y };
    };

    const startDrawing = (
        e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
    ) => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.style.background = 'black';
            const ctx = canvas.getContext('2d');
            const { x, y } = getCanvasRelativeCoords(e);
            if (ctx) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                setIsDrawing(true);
            }
        }
    };

    const draw = (
        e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
    ) => {
        if (!isDrawing) return;
        
        // Prevent default touch behavior to avoid scrolling
        if ('touches' in e) {
            e.preventDefault();
        }
        
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            const { x, y } = getCanvasRelativeCoords(e);
            if (ctx) {
                ctx.strokeStyle = color;
                ctx.lineTo(x, y);
                ctx.stroke();
            }
        }
    };

    const stopDrawing = () => setIsDrawing(false);

    const runRoute = async () => {
        setLoading(true);
        const canvas = canvasRef.current;
        if (canvas) {
            try {
                const response = await axios({
                    method: 'post',
                    url: `${API_URL}/calculate`,
                    data: {
                        image: canvas.toDataURL('image/png'),
                        dict_of_vars: dictOfVars
                    }
                });
                const resp = await response.data;
                
                // Handle the new response structure
                if (!resp.data || resp.data.length === 0) {
                    setLatexExpression(null);
                    toast.error('Oops! No answer found. Try drawing your math problem a little clearer!', {
                        description: 'Make sure your math problem is visible and clear.',
                        duration: 2000,
                        position: 'top-center',
                        className: 'bg-black text-white border border-white rounded-xl font-semibold'
                    });
                    setLoading(false);
                    return;
                }

                // Process the first result (taking the first item from the data array)
                const firstResult = resp.data[0];
                
                // Calculate drawing bounds for positioning
                const ctx = canvas.getContext('2d');
                const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
                let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
                for (let y = 0; y < canvas.height; y++) {
                    for (let x = 0; x < canvas.width; x++) {
                        const i = (y * canvas.width + x) * 4;
                        if (imageData.data[i + 3] > 0) {
                            minX = Math.min(minX, x);
                            minY = Math.min(minY, y);
                            maxX = Math.max(maxX, x);
                            maxY = Math.max(maxY, y);
                        }
                    }
                }
            

                // Set the result for display
                setTimeout(() => {
                    setResult({
                        expression: firstResult.expr,
                        answer: firstResult.result
                    });
                    setLoading(false);
                }, 1000);

                // Only update dictOfVars if assign is true
                if (firstResult.assign === true) {
                    setDictOfVars({
                        ...dictOfVars,
                        [firstResult.expr]: firstResult.result
                    });
                }
            } catch {
                setLoading(false);
                toast.error('Something went wrong. Please try again!', {
                    description: 'Check your internet connection or try a different problem.',
                    duration: 2000,
                    position: 'top-center',
                    className: 'bg-black text-white border border-white rounded-xl font-semibold'
                });
            }
        } else {
            setLoading(false);
        }
    };

    return (
        <>
            <Toaster position="bottom-right" />
            <div className="flex flex-col items-center min-h-screen bg-black pt-4 px-2 sm:pt-8 sm:px-0 pb-6">
                {/* Responsive Section Header */}
                <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-2 text-center leading-tight">
                    AI Math Canvas
                </h1>
                <p className="text-xs sm:text-base md:text-lg text-gray-300 mb-4 sm:mb-6 text-center">
                    <strong>AI Math Canvas</strong> - Draw your math problem, pick a color, and let AI solve it for you!
                </p>
                <div className="flex flex-wrap gap-2 sm:gap-4 items-center justify-center mb-4 sm:mb-6 w-full">
                    <Button
                        onClick={() => setReset(true)}
                        variant="destructive"
                        size="lg"
                        className="flex items-center gap-2 px-3 py-2 sm:px-6 sm:py-2 rounded-lg bg-red-600 text-white font-semibold shadow hover:bg-red-700 text-xs sm:text-base"
                    >
                        <RefreshCw size={18} />
                        Reset
                    </Button>
                    <div className="flex gap-1 sm:gap-2">
                        {SWATCHES.map((swatch) => (
                            <button
                                key={swatch}
                                onClick={() => setColor(swatch)}
                                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-all ${color === swatch ? 'border-yellow-400 scale-110 shadow' : 'border-gray-500'} `}
                                style={{ background: swatch }}
                                aria-label={`Select color ${swatch}`}
                            >
                                {color === swatch && <Paintbrush size={12} className="text-yellow-400" />}
                            </button>
                        ))}
                    </div>
                    <Button
                        onClick={runRoute}
                        variant="default"
                        size="lg"
                        className="flex items-center gap-2 px-3 py-2 sm:px-6 sm:py-2 rounded-lg bg-green-600 text-white font-semibold shadow hover:bg-green-700 text-xs sm:text-base"
                    >
                        <Play size={18} />
                        Run
                    </Button>
                </div>
                {loading && (
                    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-90 px-4">
                        <div className="flex flex-col items-center gap-4 sm:gap-6">
                            <div className="three-body">
                                <div className="three-body__dot"></div>
                                <div className="three-body__dot"></div>
                                <div className="three-body__dot"></div>
                            </div>
                            <div className="text-lg sm:text-2xl font-bold text-indigo-400 drop-shadow mb-1 text-center">Solving your math magic...</div>
                            <div className="text-base sm:text-lg text-white font-medium text-center px-2">
                                Please wait while the AI thinks just for you.<br />
                                <span className="text-indigo-400">Math is fun when you explore!</span>
                            </div>
                        </div>
                    </div>
                )}
                <div className="relative w-full flex-1 rounded-xl overflow-hidden shadow border border-gray-700 bg-black" style={{ minHeight: '40vh', height: '60vh' }}>
                    <canvas
                        ref={canvasRef}
                        id="canvas"
                        className="absolute top-0 left-0 w-full h-full rounded-xl"
                        style={{
                            touchAction: 'none', // Prevent scrolling while drawing
                            cursor: 'url("data:image/svg+xml,%3Csvg width=\'24\' height=\'24\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'4\' fill=\'white\'/%3E%3C/svg%3E") 12 12, pointer'
                        }}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseOut={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        onTouchCancel={stopDrawing}
                    />
                    {/* {latexExpression && (
                        <Draggable
                            defaultPosition={latexPosition}
                            onStop={(_, data) => setLatexPosition({ x: data.x, y: data.y })}
                        >
                            <div className="absolute p-2 sm:p-4 bg-gray-800 bg-opacity-95 text-white rounded-lg shadow-lg border border-gray-600 max-w-[95vw] sm:max-w-md md:max-w-lg cursor-move">
                                <div className="latex-content text-sm sm:text-base md:text-lg font-bold break-words">
                                    {latexExpression}
                                </div>
                            </div>
                        </Draggable>
                    )} */}
                </div>
                
                {/* Answer Display Section */}
                {result && (
                    <div className="w-full mt-4 p-4 bg-gray-900 rounded-xl border border-gray-700 shadow-lg max-w-4xl">
                        <div className="mb-3">
                            <h3 className="text-lg sm:text-xl font-bold text-indigo-400 mb-2 flex items-center gap-2">
                                <span className="text-2xl">🧮</span>
                                Problem:
                            </h3>
                            <p className="text-gray-200 text-sm sm:text-base leading-relaxed">
                                {result.expression}
                            </p>
                        </div>
                        <div>
                            <h3 className="text-lg sm:text-xl font-bold text-green-400 mb-2 flex items-center gap-2">
                                <span className="text-2xl">✅</span>
                                Solution:
                            </h3>
                            <div className="text-gray-200 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                                {result.answer}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
