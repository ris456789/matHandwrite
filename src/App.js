import React, { useState, useEffect } from 'react';

export default function PDFHandwritingConverter() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false);
  const [penColor, setPenColor] = useState('#1a4d8f');
  const [strokeIntensity, setStrokeIntensity] = useState(2);
  const [paperType, setPaperType] = useState('plain');
  const [activeTab, setActiveTab] = useState('landing');
  const [textMode, setTextMode] = useState('text');
  const [textInput, setTextInput] = useState('');
  const [subscription, setSubscription] = useState({ subscribed: false, plan: null });
  const [conversionsUsed, setConversionsUsed] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    const pdfScript = document.createElement('script');
    pdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    pdfScript.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      setPdfLibLoaded(true);
    };
    document.body.appendChild(pdfScript);
  }, []);

  const handleSignIn = () => {
    setIsSignedIn(true);
    setShowAuthModal(false);
  };

  const handleSignOut = () => {
    setIsSignedIn(false);
    setPages([]);
    setConversionsUsed(0);
    setTextInput('');
    setActiveTab('landing');
  };

  const handleCheckout = (plan) => {
    alert(`In production, this would redirect to Stripe checkout for the ${plan} plan!`);
    setSubscription({ subscribed: true, plan });
    setShowPaywall(false);
  };

  const canConvert = () => {
    if (subscription.subscribed) {
      if (subscription.plan === 'starter') {
        return conversionsUsed < 10;
      }
      return true;
    }
    return conversionsUsed < 1;
  };

  const incrementConversions = () => {
    if (!isSignedIn) return;
    const newCount = conversionsUsed + 1;
    setConversionsUsed(newCount);
    if (!subscription.subscribed && newCount >= 1) {
      setShowPaywall(true);
    }
  };

  const handleTextFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const maxSize = 25 * 1024 * 1024;
    const warnSize = 5 * 1024 * 1024;
    
    if (file.size > maxSize) {
      alert('❌ File size exceeds 25MB limit. Please upload a smaller file.');
      e.target.value = '';
      return;
    }
    
    if (file.size > warnSize) {
      if (!window.window.confirm(`⚠️ This file is ${(file.size / 1024 / 1024).toFixed(1)}MB. Large files may take longer to process. Continue?`)) {
        e.target.value = '';
        return;
      }
    }
    
    setLoading(true);
    setLoadingMessage('Reading file...');
    
    try {
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        if (pdf.numPages > 20) {
          if (!window.confirm(`⚠️ PDF has ${pdf.numPages} pages. Only the first 20 pages will be extracted for Text Mode. This may result in a LOT of text that won't fit on one handwritten page.\n\nContinue anyway?`)) {
            setLoading(false);
            setLoadingMessage('');
            e.target.value = '';
            return;
          }
        } else if (pdf.numPages > 10) {
          if (!window.confirm(`⚠️ PDF has ${pdf.numPages} pages. Extracting text from all pages may result in too much text to fit on one handwritten page.\n\nContinue?`)) {
            setLoading(false);
            setLoadingMessage('');
            e.target.value = '';
            return;
          }
        }
        
        let allText = '';
        const pagesToExtract = Math.min(pdf.numPages, 20);
        
        for (let i = 1; i <= pagesToExtract; i++) {
          setLoadingMessage(`Extracting text from page ${i} of ${pagesToExtract}...`);
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          allText += pageText + '\n\n';
        }
        
        if (allText.length > 15000) {
          if (!window.confirm(`⚠️ Extracted text is ${allText.length.toLocaleString()} characters (approx. ${Math.ceil(allText.length / 5000)} pages needed). This is way too long for one handwritten page!\n\nMost content will be cut off. Continue anyway?`)) {
            setLoading(false);
            setLoadingMessage('');
            e.target.value = '';
            return;
          }
        } else if (allText.length > 8000) {
          if (!window.confirm(`⚠️ Extracted text is ${allText.length.toLocaleString()} characters. This is quite long and will likely be cut off.\n\nContinue?`)) {
            setLoading(false);
            setLoadingMessage('');
            e.target.value = '';
            return;
          }
        } else if (allText.length > 5000) {
          if (!window.confirm(`⚠️ Extracted text is ${allText.length.toLocaleString()} characters. Some content may not fit on one page. Continue?`)) {
            setLoading(false);
            setLoadingMessage('');
            e.target.value = '';
            return;
          }
        }
        
        setTextInput(allText);
      } else if (file.type.startsWith('text/')) {
        const text = await file.text();
        
        if (text.length > 15000) {
          if (!window.confirm(`⚠️ Text file is ${text.length.toLocaleString()} characters. This is way too long for one handwritten page and most will be cut off!\n\nContinue anyway?`)) {
            setLoading(false);
            setLoadingMessage('');
            e.target.value = '';
            return;
          }
        } else if (text.length > 8000) {
          if (!window.confirm(`⚠️ Text file is ${text.length.toLocaleString()} characters. This is quite long and will likely be cut off. Continue?`)) {
            setLoading(false);
            setLoadingMessage('');
            e.target.value = '';
            return;
          }
        } else if (text.length > 5000) {
          if (!window.confirm(`⚠️ Text file is ${text.length.toLocaleString()} characters. Some content may not fit. Continue?`)) {
            setLoading(false);
            setLoadingMessage('');
            e.target.value = '';
            return;
          }
        }
        
        setTextInput(text);
      } else {
        alert('❌ Please upload a PDF or text file');
      }
    } catch (error) {
      alert('❌ Error loading file: ' + error.message);
    }
    
    setLoading(false);
    setLoadingMessage('');
    e.target.value = '';
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const maxSize = 25 * 1024 * 1024;
    const warnSize = 5 * 1024 * 1024;
    
    if (file.size > maxSize) {
      alert('❌ File size exceeds 25MB limit. Please upload a smaller file.');
      e.target.value = '';
      return;
    }
    
    if (file.size > warnSize) {
      if (!window.confirm(`⚠️ This file is ${(file.size / 1024 / 1024).toFixed(1)}MB. Processing may be slow. Continue?`)) {
        e.target.value = '';
        return;
      }
    }
    
    if (file.type === 'application/pdf') {
      handlePDFUpload(file);
    } else if (file.type.startsWith('text/')) {
      handleTextUpload(file);
    } else if (file.type.startsWith('image/')) {
      handleImageUpload(file);
    } else {
      alert('❌ Please upload a PDF, text file, or image');
    }
    
    e.target.value = '';
  };

  const handlePDFUpload = async (file) => {
    setLoading(true);
    setLoadingMessage('Reading PDF...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      if (pdf.numPages > 50) {
        alert(`⚠️ PDF has ${pdf.numPages} pages. Only the first 50 will be processed to prevent browser slowdown.`);
      } else if (pdf.numPages > 20) {
        if (!window.confirm(`⚠️ PDF has ${pdf.numPages} pages. This may take a while to process. Continue?`)) {
          setLoading(false);
          return;
        }
      }
      
      const loadedPages = [];
      const pagesToProcess = Math.min(pdf.numPages, 50);
      
      for (let i = 1; i <= pagesToProcess; i++) {
        setLoadingMessage(`Processing page ${i} of ${pagesToProcess}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        
        loadedPages.push({
          original: canvas.toDataURL(),
          handwritten: null,
          width: viewport.width,
          height: viewport.height
        });
      }
      setPages(loadedPages);
    } catch (error) {
      alert('❌ Error loading PDF: ' + error.message);
    }
    setLoading(false);
    setLoadingMessage('');
  };

  const handleTextUpload = async (file) => {
    setLoading(true);
    setLoadingMessage('Processing text file...');
    try {
      const text = await file.text();
      
      if (text.length > 10000) {
        if (!window.confirm(`⚠️ Text is ${text.length} characters. This may not fit on one page. Continue?`)) {
          setLoading(false);
          setLoadingMessage('');
          return;
        }
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = 2100;
      canvas.height = 2970;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'black';
      ctx.font = '40px Arial';
      const lines = text.split('\n');
      let y = 100;
      const maxLines = Math.floor((canvas.height - 200) / 60);
      
      if (lines.length > maxLines) {
        alert(`⚠️ Text has ${lines.length} lines but only ${maxLines} will fit. Content will be truncated.`);
      }
      
      lines.slice(0, maxLines).forEach(line => {
        ctx.fillText(line, 100, y);
        y += 60;
      });
      
      setPages([{
        original: canvas.toDataURL(),
        handwritten: null,
        width: canvas.width,
        height: canvas.height
      }]);
    } catch (error) {
      alert('❌ Error loading text file: ' + error.message);
    }
    setLoading(false);
    setLoadingMessage('');
  };

  const handleImageUpload = async (file) => {
    setLoading(true);
    setLoadingMessage('Loading image...');
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => {
        alert('❌ Error reading image file');
        setLoading(false);
        setLoadingMessage('');
        resolve();
      };
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => {
          alert('❌ Error loading image. Please try a different file.');
          setLoading(false);
          setLoadingMessage('');
          resolve();
        };
        img.onload = () => {
          if (img.width > 5000 || img.height > 5000) {
            alert(`⚠️ Image is very large (${img.width}x${img.height}). Processing may be slow.`);
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          
          setPages([{
            original: canvas.toDataURL(),
            handwritten: null,
            width: canvas.width,
            height: canvas.height
          }]);
          setLoading(false);
          setLoadingMessage('');
          resolve();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const createPaperTexture = (ctx, width, height, type) => {
    ctx.fillStyle = type === 'aged' ? '#f4e8d0' : '#fcf8f0';
    ctx.fillRect(0, 0, width, height);
    
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 30000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#d8d0c0' : '#e8e4dc';
      ctx.fillRect(Math.random() * width, Math.random() * height, Math.random() * 3, Math.random() * 3);
    }
    ctx.globalAlpha = 1;
    
    if (type === 'lined') {
      ctx.strokeStyle = '#b8d4f5';
      ctx.lineWidth = 2;
      const lineSpacing = height / 35;
      for (let i = 0; i < 35; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * lineSpacing + 80);
        ctx.lineTo(width, i * lineSpacing + 80);
        ctx.stroke();
      }
      ctx.strokeStyle = '#ffb8b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(width * 0.12, 0);
      ctx.lineTo(width * 0.12, height);
      ctx.stroke();
    } else if (type === 'aged') {
      ctx.globalAlpha = 0.15;
      for (let i = 0; i < 25; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 150 + 100;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, '#c4a573');
        gradient.addColorStop(0.5, '#d4b896');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.2;
      for (let i = 0; i < 100; i++) {
        ctx.fillStyle = '#b89968';
        ctx.fillRect(Math.random() * width, Math.random() * height, Math.random() * 5, Math.random() * 5);
      }
      ctx.globalAlpha = 1;
    }
  };

  const convertTextToHandwriting = () => {
    if (!canConvert()) {
      setShowPaywall(true);
      return;
    }

    if (!textInput.trim()) {
      alert('Please enter some text or upload a file!');
      return;
    }

    const wordCount = textInput.split(/\s+/).filter(w => w.length > 0).length;
    const charCount = textInput.length;
    
    if (charCount > 15000) {
      if (!window.confirm(`⚠️ Your text is ${charCount.toLocaleString()} characters (${wordCount} words).\n\nThis is WAY too long for one page - most content will be cut off!\n\nRecommendation: Reduce to under 5,000 characters.\n\nContinue anyway?`)) {
        return;
      }
    } else if (charCount > 8000) {
      if (!window.confirm(`⚠️ Your text is ${charCount.toLocaleString()} characters (${wordCount} words).\n\nThis is quite long and will likely be cut off.\n\nContinue?`)) {
        return;
      }
    } else if (charCount > 5000) {
      if (!window.confirm(`⚠️ Your text is ${charCount.toLocaleString()} characters (${wordCount} words).\n\nSome content may not fit on one page. Continue?`)) {
        return;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = 2100;
    canvas.height = 2970;
    const ctx = canvas.getContext('2d');
    
    createPaperTexture(ctx, canvas.width, canvas.height, paperType);
    
    const styleConfig = {
      text: { fontSize: 42, lineHeight: 60, slant: 0, fontFamily: 'Arial, sans-serif', wobble: 1.5, letterSpacing: 1, italic: false },
      journal: { fontSize: 48, lineHeight: 70, slant: 0.03, fontFamily: 'Georgia, serif', wobble: 3, letterSpacing: 1.5, italic: false },
      cute: { fontSize: 52, lineHeight: 75, slant: -0.03, fontFamily: 'Comic Sans MS, cursive', wobble: 2.5, letterSpacing: 1, italic: true },
      signature: { fontSize: 55, lineHeight: 80, slant: 0.15, fontFamily: 'Georgia, serif', wobble: 4, letterSpacing: 2, italic: true },
      flashcard: { fontSize: 38, lineHeight: 55, slant: 0, fontFamily: 'Arial, sans-serif', wobble: 1, letterSpacing: 1, italic: false },
      cursive: { fontSize: 50, lineHeight: 72, slant: 0.12, fontFamily: 'Brush Script MT, cursive', wobble: 2, letterSpacing: 2.5, italic: true }
    };
    
    const { fontSize, lineHeight, slant, fontFamily, wobble, letterSpacing, italic } = styleConfig[textMode];
    
    ctx.font = `${italic ? 'italic' : 'normal'} ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';
    
    const words = textInput.split(/\s+/).filter(word => word.length > 0);
    
    let x = 100, y = 100;
    const maxWidth = canvas.width - 200;
    let overflow = false;
    
    words.forEach((word) => {
      const metrics = ctx.measureText(word + ' ');
      
      if (x + metrics.width > maxWidth) {
        x = 100;
        y += lineHeight + Math.random() * 5;
      }
      
      if (y > canvas.height - 150) {
        overflow = true;
        return;
      }
      
      ctx.save();
      ctx.translate(x, y);
      ctx.transform(1, slant, 0, 1, 0, 0);
      
      ctx.fillStyle = penColor;
      ctx.globalAlpha = 0.85 + Math.random() * 0.15;
      ctx.fillText(word, (Math.random() - 0.5) * wobble, (Math.random() - 0.5) * wobble);
      
      ctx.restore();
      
      x += metrics.width + letterSpacing;
    });
    
    if (overflow) {
      alert('⚠️ Warning: Your text was too long to fit on one page. Content was cut off.\n\nTip: Use the Flashcard style (smallest font) or reduce your text to under 5,000 characters.');
    }
    
    setPages([{
      original: canvas.toDataURL(),
      handwritten: canvas.toDataURL(),
      width: canvas.width,
      height: canvas.height
    }]);
    incrementConversions();
  };

  const applyMathHandwriting = (pageIndex, skipConversionCheck = false) => {
    if (!skipConversionCheck && !canConvert()) {
      setShowPaywall(true);
      return Promise.resolve(false);
    }
    
    return new Promise((resolve) => {
      const page = pages[pageIndex];
      if (!page || !page.original) {
        alert('❌ Error: Page data not found');
        resolve(false);
        return;
      }
      
      const img = new Image();
      img.onerror = () => {
        alert('❌ Error loading image. Please try again.');
        resolve(false);
      };
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = page.width;
          canvas.height = page.height;
          const ctx = canvas.getContext('2d');
          createPaperTexture(ctx, canvas.width, canvas.height, paperType);
          ctx.globalCompositeOperation = 'multiply';
          ctx.drawImage(img, 0, 0);
          ctx.globalCompositeOperation = 'source-over';
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          const [penR, penG, penB] = [
            parseInt(penColor.slice(1, 3), 16),
            parseInt(penColor.slice(3, 5), 16),
            parseInt(penColor.slice(5, 7), 16)
          ];
          
          const darkPixels = [];
          for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            if (brightness < 200) {
              darkPixels.push({
                x: (i / 4) % canvas.width,
                y: Math.floor((i / 4) / canvas.width),
                brightness,
                index: i
              });
            }
          }
          
          if (darkPixels.length > 500000) {
            if (!window.confirm(`⚠️ This page has a lot of content (${Math.floor(darkPixels.length / 1000)}k pixels). Processing may take 10-30 seconds. Continue?`)) {
              resolve(false);
              return;
            }
          }
          
          const [paperR, paperG, paperB] = paperType === 'aged' ? [244, 232, 208] : [252, 248, 240];
          for (const pixel of darkPixels) {
            data[pixel.index] = paperR;
            data[pixel.index + 1] = paperG;
            data[pixel.index + 2] = paperB;
          }
          ctx.putImageData(imageData, 0, 0);

          const intensity = strokeIntensity;
          const noise = (x, y) => Math.sin(x * 0.05 + y * 0.034) * Math.cos(y * 0.062 - x * 0.026);
          const slantAngle = (Math.random() - 0.5) * 0.05;

          for (let i = 0; i < darkPixels.length; i++) {
            const pixel = darkPixels[i];
            const noiseVal = noise(pixel.x, pixel.y);
            const totalWobbleX = noiseVal * intensity * 1.5 + (Math.random() - 0.5) * intensity * 1.2 + pixel.y * slantAngle;
            const totalWobbleY = Math.sin(pixel.x * 0.03) * intensity * 0.8 + (Math.random() - 0.5) * intensity * 1.2;
            const pressureVar = 0.5 + Math.abs(Math.sin(i * 0.1)) * 0.5;
            const thickness = (0.9 + Math.random() * 0.6) * pressureVar * intensity * 0.5;
            const pressureDarkness = 0.7 + pressureVar * 0.3;
            const inkVariation = 0.9 + Math.random() * 0.1;
            
            ctx.fillStyle = `rgb(${penR * pressureDarkness * inkVariation}, ${penG * pressureDarkness * inkVariation}, ${penB * pressureDarkness * inkVariation})`;
            ctx.beginPath();
            ctx.arc(pixel.x + totalWobbleX, pixel.y + totalWobbleY, thickness, 0, Math.PI * 2);
            ctx.fill();
            
            if (i % 3 === 0) {
              ctx.globalAlpha = 0.4;
              ctx.beginPath();
              ctx.arc(pixel.x + totalWobbleX + (Math.random() - 0.5) * intensity * 0.5, 
                      pixel.y + totalWobbleY + (Math.random() - 0.5) * intensity * 0.5, 
                      thickness * 0.6, 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = 1;
            }
          }
          
          ctx.globalAlpha = 0.5;
          for (let i = 0; i < darkPixels.length - 10; i += 3) {
            const p1 = darkPixels[i];
            const p2 = darkPixels[i + Math.floor(Math.random() * 8) + 2];
            const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
            if (dist < 8 && Math.random() > 0.4) {
              ctx.strokeStyle = penColor;
              ctx.lineWidth = 0.4 + Math.random() * 0.6;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.quadraticCurveTo((p1.x + p2.x) / 2 + (Math.random() - 0.5) * intensity, 
                                   (p1.y + p2.y) / 2 + (Math.random() - 0.5) * intensity, 
                                   p2.x, p2.y);
              ctx.stroke();
            }
          }
          ctx.globalAlpha = 1;
          
          const newPages = [...pages];
          newPages[pageIndex].handwritten = canvas.toDataURL();
          setPages(newPages);
          
          if (!skipConversionCheck) {
            incrementConversions();
          }
          
          resolve(true);
        } catch (error) {
          alert('❌ Error processing image: ' + error.message);
          resolve(false);
        }
      };
      
      img.src = page.original;
    });
  };

  const applyToAll = async () => {
    if (!canConvert()) {
      setShowPaywall(true);
      return;
    }
    
    if (pages.length > 10) {
      if (!window.confirm(`⚠️ You're about to convert ${pages.length} pages. This may take several minutes. Continue?`)) {
        return;
      }
    }
    
    setLoading(true);
    for (let i = 0; i < pages.length; i++) {
      setLoadingMessage(`Converting page ${i + 1} of ${pages.length}...`);
      await applyMathHandwriting(i, true);
    }
    setLoading(false);
    setLoadingMessage('');
    
    incrementConversions();
  };

  const downloadPage = (pageIndex) => {
    const page = pages[pageIndex];
    const link = document.createElement('a');
    link.download = `handwritten-page-${pageIndex + 1}.png`;
    link.href = page.handwritten || page.original;
    link.click();
  };

  const handleApplyStrokesClick = async (pageIndex) => {
    setLoading(true);
    setLoadingMessage(`Processing page ${pageIndex + 1}...`);
    await applyMathHandwriting(pageIndex, false);
    setLoading(false);
    setLoadingMessage('');
  };

  const removePage = (pageIndex) => {
    const newPages = pages.filter((_, index) => index !== pageIndex);
    setPages(newPages);
  };

  const downloadAll = async () => {
    for (let i = 0; i < pages.length; i++) {
      downloadPage(i);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800 backdrop-blur-sm bg-black/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-xl">∫</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              matHandwrite
            </span>
          </div>
          <div>
            {isSignedIn ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-sm font-bold">
                  U
                </div>
                <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-white">
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => setShowAuthModal(true)} className="px-5 py-2 text-gray-300 hover:text-white transition-colors font-medium">
                  Sign In
                </button>
                <button onClick={() => setShowAuthModal(true)} className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-lg font-medium transition-all shadow-lg shadow-blue-500/20">
                  Get Started
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-3xl font-bold mb-6 text-center">Welcome!</h2>
            <p className="text-gray-400 text-center mb-8">
              This is a preview. In production, Clerk authentication would handle sign-in.
            </p>
            <button onClick={handleSignIn} className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl font-medium transition-all shadow-lg shadow-blue-500/30 mb-4">
              Sign In (Demo)
            </button>
            <button onClick={() => setShowAuthModal(false)} className="w-full px-6 py-3 text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {activeTab === 'landing' && (
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center space-y-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-sm text-blue-400 mb-4">
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
              No LaTeX Required • 6 Handwriting Styles • Math & Text Modes • Instant Results
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-3xl -z-10"></div>
              <h1 className="text-6xl md:text-8xl font-black leading-tight mb-6">
                <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent" style={{
                  fontFamily: 'Georgia, serif',
                  fontWeight: '300',
                  fontStyle: 'italic',
                  letterSpacing: '-0.02em'
                }}>
                  Transform
                </span>
                <span className="block text-white font-bold mt-2" style={{ letterSpacing: '-0.03em' }}>digital documents into</span>
                <span className="block bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent font-bold mt-2" style={{ letterSpacing: '-0.03em' }}>
                  authentic handwriting
                </span>
              </h1>
            </div>
            
            <p className="text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Professional handwriting conversion for <span className="text-purple-400 font-semibold">students, educators, and professionals</span>.
              <span className="block mt-2">Choose your mode and get instant, realistic results.</span>
            </p>

            <div className="grid md:grid-cols-2 gap-8 pt-12 max-w-4xl mx-auto">
              <div onClick={() => { setActiveTab('math'); setIsSignedIn(true); }} className="cursor-pointer bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-blue-500 rounded-3xl p-10 hover:scale-105 transition-all hover:shadow-2xl hover:shadow-blue-500/20">
                <div className="text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <span className="text-6xl">🧮</span>
                  </div>
                  <h3 className="text-3xl font-bold mb-4">Math Mode</h3>
                  <p className="text-gray-400 text-lg mb-4">Upload PDFs or images with equations, formulas, and mathematical notation. Pixel-perfect preservation.</p>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full text-xs text-green-400 mb-4">
                    <span>✓</span>
                    No LaTeX Required - Just Upload PDF
                  </div>
                  <div className="inline-block px-6 py-3 bg-blue-600 rounded-xl font-semibold mt-2 w-full">
                    Start with Math Mode →
                  </div>
                </div>
              </div>

              <div onClick={() => { setActiveTab('text'); setIsSignedIn(true); }} className="cursor-pointer bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-purple-500 rounded-3xl p-10 hover:scale-105 transition-all hover:shadow-2xl hover:shadow-purple-500/20">
                <div className="text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <span className="text-6xl">📝</span>
                  </div>
                  <h3 className="text-3xl font-bold mb-4">Text Modes</h3>
                  <p className="text-gray-400 text-lg mb-6">Type, paste, or upload text files and convert to 6 different handwriting styles. Perfect for notes and essays.</p>
                  <div className="inline-block px-6 py-3 bg-purple-600 rounded-xl font-semibold">
                    Start with Text Mode →
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-8 pt-4 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>100% Private</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>Instant Results</span>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8 pt-20 max-w-6xl mx-auto">
              <div className="group bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-3xl p-8 hover:border-blue-500/50 transition-all hover:scale-105 transform">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform">
                  <span className="text-4xl">🧮</span>
                </div>
                <h3 className="text-2xl font-bold mb-3">Math Mode</h3>
                <p className="text-gray-400 leading-relaxed mb-3">Pixel-perfect conversion for equations, formulas, and mathematical notation. Preserves every symbol exactly as-is.</p>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-xs text-green-400">
                  <span>✓</span>
                  No LaTeX Required
                </div>
              </div>

              <div className="group bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-3xl p-8 hover:border-purple-500/50 transition-all hover:scale-105 transform">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform">
                  <span className="text-4xl">✨</span>
                </div>
                <h3 className="text-2xl font-bold mb-3">6 Handwriting Styles</h3>
                <p className="text-gray-400 leading-relaxed">From clean and readable to flowing cursive, bubbly to elegant signatures. Type or upload text files.</p>
              </div>

              <div className="group bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-3xl p-8 hover:border-pink-500/50 transition-all hover:scale-105 transform">
                <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform">
                  <span className="text-4xl">⚡</span>
                </div>
                <h3 className="text-2xl font-bold mb-3">Lightning Fast</h3>
                <p className="text-gray-400 leading-relaxed">Convert entire documents in seconds. Process 50+ pages at once. Download high-quality PNG files instantly.</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-500/20 rounded-3xl p-12 mt-20 max-w-5xl mx-auto">
              <h2 className="text-4xl font-bold text-center mb-10">Why Choose matHandwrite?</h2>
              <div className="grid md:grid-cols-2 gap-8 text-left">
                <div className="flex gap-4">
                  <span className="text-3xl flex-shrink-0">💰</span>
                  <div>
                    <strong className="text-xl text-white">Save Time & Money</strong>
                    <p className="text-gray-400 mt-2">Stop spending hours handwriting notes. Convert 50 pages in the time it takes to write one. Focus on what matters.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <span className="text-3xl flex-shrink-0">🎯</span>
                  <div>
                    <strong className="text-xl text-white">Perfect for STEM Students</strong>
                    <p className="text-gray-400 mt-2">Math Mode preserves complex equations, Greek letters, and scientific notation. No LaTeX required - just upload your PDF and we handle the rest.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <span className="text-3xl flex-shrink-0">✍️</span>
                  <div>
                    <strong className="text-xl text-white">6 Handwriting Styles</strong>
                    <p className="text-gray-400 mt-2">Multiple unique styles mean your handwriting looks different for each project. Clean for homework, casual for journals, elegant for signatures.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <span className="text-3xl flex-shrink-0">🔒</span>
                  <div>
                    <strong className="text-xl text-white">100% Privacy Guaranteed</strong>
                    <p className="text-gray-400 mt-2">All processing happens in your browser. Your documents never touch our servers. Complete privacy.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <span className="text-3xl flex-shrink-0">📱</span>
                  <div>
                    <strong className="text-xl text-white">Works Everywhere</strong>
                    <p className="text-gray-400 mt-2">Use on any device - desktop, laptop, tablet. No app installation required. Just open and convert.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <span className="text-3xl flex-shrink-0">🎨</span>
                  <div>
                    <strong className="text-xl text-white">Customize Everything</strong>
                    <p className="text-gray-400 mt-2">Choose pen colors, paper types (plain, lined, aged), and handwriting intensity. Make it truly yours.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-24 max-w-5xl mx-auto">
              <h2 className="text-4xl font-bold text-center mb-4">How It Works</h2>
              <p className="text-gray-400 text-center mb-12">Three simple steps to beautiful handwriting</p>
              <div className="grid md:grid-cols-3 gap-12">
                <div className="text-center relative">
                  <div className="absolute top-8 left-1/2 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 -z-10 hidden md:block" style={{ transform: 'translateX(-50%)' }}></div>
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10">
                    <span className="text-5xl">1️⃣</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Choose Mode</h3>
                  <p className="text-gray-400">Select Math Mode for equations or Text Mode for regular handwriting. Each optimized for different needs.</p>
                </div>
                <div className="text-center relative">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10">
                    <span className="text-5xl">2️⃣</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Add Content</h3>
                  <p className="text-gray-400">Upload files (Math Mode) or type/paste/upload text (Text Mode). Customize style, colors, and paper type.</p>
                </div>
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-5xl">3️⃣</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Download</h3>
                  <p className="text-gray-400">Get your handwritten document as high-quality PNG. Print it, share it, or submit it - looks 100% authentic.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSignedIn && activeTab === 'text' && pages.length === 0 && (
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveTab('landing')} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-all">
                  ← Back
                </button>
                <h2 className="text-3xl font-bold">Text Mode</h2>
              </div>
              <button onClick={() => setActiveTab('math')} className="px-4 py-2 bg-blue-600/20 border border-blue-500 hover:bg-blue-600/30 rounded-lg transition-all text-sm flex items-center gap-2">
                <span>🧮</span>
                Switch to Math Mode
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">✍️ Handwriting Style</label>
                <select value={textMode} onChange={(e) => setTextMode(e.target.value)} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-white">
                  <option value="text">📝 Text-to-Handwriting (Clean & Readable)</option>
                  <option value="journal">📔 Journal Mode (Natural & Casual)</option>
                  <option value="cute">💕 Cute Aesthetic (Bubbly & Fun)</option>
                  <option value="signature">✒️ Signature Style (Elegant & Slanted)</option>
                  <option value="flashcard">🗂️ Flashcard Mode (Compact & Clear)</option>
                  <option value="cursive">🖋️ Cursive (Flowing & Connected)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">📝 Your Text</label>
                <div className="mb-4">
                  <label className="cursor-pointer inline-block px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-all text-sm">
                    📤 Upload Text/PDF File
                    <input type="file" accept="application/pdf,text/*" onChange={handleTextFileUpload} className="hidden" />
                  </label>
                  <span className="text-gray-500 text-sm ml-4">or type/paste below</span>
                </div>
                <textarea 
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type or paste your text here... (or upload a file above)"
                  className="w-full h-64 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-white resize-none"
                />
                <div className="text-right mt-2">
                  <span className={`text-sm font-medium ${
                    textInput.length > 15000 ? 'text-red-500' : 
                    textInput.length > 8000 ? 'text-orange-400' :
                    textInput.length > 5000 ? 'text-yellow-400' : 
                    'text-gray-500'
                  }`}>
                    {textInput.length.toLocaleString()} characters
                    {textInput.length > 15000 && ' 🚨 Way too long!'}
                    {textInput.length > 8000 && textInput.length <= 15000 && ' ⚠️ Very long'}
                    {textInput.length > 5000 && textInput.length <= 8000 && ' ⚠️ Long'}
                  </span>
                  {textInput.length > 5000 && (
                    <div className="text-xs text-gray-400 mt-1">
                      Recommended: Keep under 5,000 characters for best results
                    </div>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">🖊️ Pen Color</label>
                  <input type="color" value={penColor} onChange={(e) => setPenColor(e.target.value)} className="h-12 w-full rounded-lg cursor-pointer bg-gray-800 border border-gray-700" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">📄 Paper Type</label>
                  <select value={paperType} onChange={(e) => setPaperType(e.target.value)} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-white">
                    <option value="plain">Plain White</option>
                    <option value="lined">Lined Notebook</option>
                    <option value="aged">Aged Paper</option>
                  </select>
                </div>
              </div>

              <button onClick={convertTextToHandwriting} disabled={loading} className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl font-bold text-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? 'Processing...' : '✨ Convert to Handwriting'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSignedIn && activeTab === 'math' && pages.length === 0 && (
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveTab('landing')} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-all">
                  ← Back
                </button>
                <h2 className="text-3xl font-bold">Math Mode</h2>
              </div>
              <button onClick={() => setActiveTab('text')} className="px-4 py-2 bg-purple-600/20 border border-purple-500 hover:bg-purple-600/30 rounded-lg transition-all text-sm flex items-center gap-2">
                <span>📝</span>
                Switch to Text Mode
              </button>
            </div>

            <div className="text-center space-y-8">
              <div className="mb-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full text-sm text-green-400 mb-2">
                  <span>✓</span>
                  No LaTeX Required - Upload Any PDF or Image
                </div>
                <p className="text-gray-400 text-sm">Perfect for typed notes, scanned homework, or any document with math equations</p>
              </div>
              <div className="border-4 border-dashed border-gray-600 rounded-3xl p-16 hover:border-blue-500 transition-all">
                <label className="cursor-pointer block">
                  <div className="space-y-4">
                    <div className="text-6xl">📤</div>
                    <p className="text-2xl font-bold">Upload Your Document</p>
                    <p className="text-gray-400">PDF, Image, or Text File (Max 25MB)</p>
                    <div className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-all">
                      Choose File
                    </div>
                  </div>
                  <input type="file" accept="application/pdf,text/*,image/*" onChange={handleFileUpload} disabled={!pdfLibLoaded || loading} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSignedIn && !subscription.subscribed && pages.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎁</span>
                <span className="text-sm">
                  <strong>Free Trial:</strong> {conversionsUsed}/1 conversion used
                </span>
              </div>
              <button onClick={() => setShowPaywall(true)} className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-lg text-sm font-medium transition-all">
                Upgrade for Unlimited
              </button>
            </div>
          </div>
        </div>
      )}

      {subscription.subscribed && pages.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✨</span>
              <span className="text-sm">
                <strong>{subscription.plan === 'starter' ? 'Starter' : subscription.plan === 'annual' ? 'Annual' : 'Pro'} Plan Active</strong> 
                {subscription.plan === 'starter' ? ` - ${conversionsUsed}/10 documents used this month` : ' - Unlimited documents'}
              </span>
            </div>
          </div>
        </div>
      )}

      {pages.length > 0 && activeTab === 'math' && (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6 mb-8">
            <div className="flex flex-wrap gap-4 mb-6">
              <button onClick={() => setActiveTab('landing')} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-all">
                ← Back
              </button>
              <button onClick={() => { setPages([]); }} className="px-4 py-2 bg-red-600/20 border border-red-500 hover:bg-red-600/30 rounded-lg transition-all text-sm flex items-center gap-2">
                <span>🗑️</span>
                Remove All & Upload New
              </button>
              <button onClick={() => { setPages([]); setActiveTab('text'); }} className="px-4 py-2 bg-purple-600/20 border border-purple-500 hover:bg-purple-600/30 rounded-lg transition-all text-sm flex items-center gap-2">
                <span>📝</span>
                Switch to Text Mode
              </button>
              <button onClick={applyToAll} disabled={loading} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 rounded-xl font-medium transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                <span>✨</span>
                Convert All Pages
              </button>
              <button onClick={downloadAll} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 rounded-xl font-medium transition-all shadow-lg shadow-green-500/20 ml-auto">
                <span>⬇️</span>
                Download All
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">🖊️ Pen Color</label>
                <input type="color" value={penColor} onChange={(e) => setPenColor(e.target.value)} className="h-10 w-24 rounded-lg cursor-pointer bg-gray-800 border border-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Wobble Intensity: {strokeIntensity}</label>
                <input type="range" min="1" max="6" step="1" value={strokeIntensity} onChange={(e) => setStrokeIntensity(parseInt(e.target.value))} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">📄 Paper Type</label>
                <select value={paperType} onChange={(e) => setPaperType(e.target.value)} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-white">
                  <option value="plain">Plain White</option>
                  <option value="lined">Lined Notebook</option>
                  <option value="aged">Aged Paper</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {pages.map((page, index) => (
              <div key={index} className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6 hover:border-gray-600 transition-all">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                  <h3 className="text-lg font-semibold">📄 Page {index + 1}</h3>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => handleApplyStrokesClick(index)} disabled={loading} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      <span>✨</span>
                      Apply Strokes
                    </button>
                    <button onClick={() => downloadPage(index)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-all">
                      <span>💾</span>
                      Download
                    </button>
                    <button onClick={() => removePage(index)} className="flex items-center gap-2 px-5 py-2.5 bg-red-600/20 border border-red-500 hover:bg-red-600/30 rounded-lg text-sm font-medium transition-all">
                      <span>🗑️</span>
                      Remove
                    </button>
                  </div>
                </div>
                <div className="border-2 border-gray-700 rounded-xl overflow-hidden bg-gray-900">
                  <img src={page.handwritten || page.original} alt={`Page ${index + 1}`} className="w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pages.length > 0 && activeTab === 'text' && (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => { setPages([]); setTextInput(''); }} className="px-4 py-2 bg-red-600/20 border border-red-500 hover:bg-red-600/30 rounded-lg transition-all flex items-center gap-2 text-sm">
                <span>🗑️</span>
                Remove & Start Over
              </button>
              <button onClick={() => { setPages([]); setTextInput(''); setActiveTab('math'); }} className="px-4 py-2 bg-blue-600/20 border border-blue-500 hover:bg-blue-600/30 rounded-lg transition-all text-sm flex items-center gap-2">
                <span>🧮</span>
                Switch to Math Mode
              </button>
            </div>
            <button onClick={() => downloadPage(0)} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 rounded-xl font-medium transition-all shadow-lg shadow-green-500/20">
              <span>💾</span>
              Download
            </button>
          </div>
          <div className="border-2 border-gray-700 rounded-xl overflow-hidden bg-gray-900">
            <img src={pages[0].handwritten} alt="Handwritten text" className="w-full" />
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-400 text-lg">{loadingMessage || 'Processing your file...'}</p>
          </div>
        </div>
      )}

      {showPaywall && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-3xl p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold mb-3">Upgrade for More Documents</h2>
              <p className="text-gray-400 text-lg">Choose a plan that works for you</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 hover:border-blue-500 transition-all">
                <h3 className="text-xl font-bold mb-2">Weekly</h3>
                <div className="text-5xl font-bold text-blue-400 mb-4">
                  $2.99<span className="text-lg text-gray-400">/week</span>
                </div>
                <ul className="space-y-2 text-sm text-gray-300 mb-6">
                  <li>✓ Unlimited conversions</li>
                  <li>✓ All modes & styles</li>
                  <li>✓ All paper types</li>
                  <li>✓ Download as PNG</li>
                  <li>✓ Cancel anytime</li>
                </ul>
                <button onClick={() => handleCheckout('weekly')} className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-all">
                  Get Weekly
                </button>
              </div>

              <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/50 border-2 border-purple-500 rounded-2xl p-6 relative transform scale-105">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-purple-600 to-purple-500 px-4 py-1 rounded-full text-xs font-bold">
                    MOST POPULAR
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2">Monthly</h3>
                <div className="text-5xl font-bold text-purple-400 mb-4">
                  $9.99<span className="text-lg text-gray-400">/mo</span>
                </div>
                <ul className="space-y-2 text-sm text-gray-300 mb-6">
                  <li>✓ Everything in Weekly</li>
                  <li>✓ Batch convert 50+ pages</li>
                  <li>✓ Priority processing</li>
                  <li>✓ Perfect for students</li>
                  <li>✓ Best value per month</li>
                </ul>
                <button onClick={() => handleCheckout('monthly')} className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-medium transition-all shadow-lg shadow-purple-500/30">
                  Get Monthly
                </button>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 hover:border-green-500 transition-all">
                <h3 className="text-xl font-bold mb-2">Annual</h3>
                <div className="text-5xl font-bold text-green-400 mb-1">
                  $29.99<span className="text-lg text-gray-400">/year</span>
                </div>
                <p className="text-xs text-green-400 font-semibold mb-4">Just $2.50/month - Save 75%!</p>
                <ul className="space-y-2 text-sm text-gray-300 mb-6">
                  <li>✓ Everything in Monthly</li>
                  <li>✓ Cover entire year</li>
                  <li>✓ Best value overall</li>
                  <li>✓ All future updates</li>
                  <li>✓ Biggest savings</li>
                </ul>
                <button onClick={() => handleCheckout('annual')} className="w-full px-6 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-medium transition-all">
                  Get Annual
                </button>
              </div>
            </div>

            <button onClick={() => setShowPaywall(false)} className="text-gray-400 hover:text-white text-sm underline mx-auto block">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}