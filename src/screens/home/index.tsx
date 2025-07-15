import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Draggable from 'react-draggable';
import { SWATCHES } from '@/constants';
import { Paintbrush, RefreshCw, Play } from 'lucide-react';
import { toast, Toaster } from 'sonner';

interface GeneratedResult {
    expression: string;
    answer: string;
}

interface Response {
    expr: string;
    result: string;
    assign: boolean;
}

const API_URL = import.meta.env.VITE_API_URL;

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('rgb(255, 255, 255)');
    const [reset, setReset] = useState(false);
    const [dictOfVars, setDictOfVars] = useState({});
    const [result, setResult] = useState<GeneratedResult>();
    const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 });
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
        const latex = `\\(\\LARGE{${expression} = ${answer}}\\)`;
        setLatexExpression(latex); // Only one answer at a time
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

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.style.background = 'black';
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.beginPath();
                ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                setIsDrawing(true);
            }
        }
    };
    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.strokeStyle = color;
                ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
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
                resp.data.forEach((data: Response) => {
                    if (data.assign === true) {
                        setDictOfVars({
                            ...dictOfVars,
                            [data.expr]: data.result
                        });
                    }
                });
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
                const centerX = (minX + maxX) / 2;
                const centerY = (minY + maxY) / 2;
                setLatexPosition({ x: centerX, y: centerY });
                resp.data.forEach((data: Response) => {
                    setTimeout(() => {
                        setResult({
                            expression: data.expr,
                            answer: data.result
                        });
                        setLoading(false);
                    }, 1000);
                });
            } catch (err) {
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
            <div className="flex flex-col items-center min-h-screen bg-black pt-4 px-2 sm:pt-8 sm:px-0">
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
                <div className="relative w-full flex-1 rounded-xl overflow-hidden shadow border border-gray-700 bg-black max-w-full sm:max-w-2xl mx-auto" style={{ minHeight: '40vh', height: '60vh' }}>
                    <canvas
                        ref={canvasRef}
                        id="canvas"
                        className="absolute top-0 left-0 w-full h-full rounded-xl"
                        style={{
                            cursor: 'url("data:image/svg+xml,%3Csvg width=\'24\' height=\'24\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'4\' fill=\'white\'/%3E%3C/svg%3E") 12 12, pointer'
                        }}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseOut={stopDrawing}
                    />
                    {latexExpression && (
                        <Draggable
                            defaultPosition={latexPosition}
                            onStop={(_, data) => setLatexPosition({ x: data.x, y: data.y })}
                        >
                            <div className="absolute p-2 sm:p-4 bg-gray-800 bg-opacity-90 text-white rounded-lg shadow border border-gray-600 max-w-[90vw] sm:max-w-xs">
                                <div className="latex-content text-base sm:text-lg font-bold">{latexExpression}</div>
                            </div>
                        </Draggable>
                    )}
                </div>
            </div>
        </>
    );
}
