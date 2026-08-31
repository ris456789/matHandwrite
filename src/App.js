import React, { useState, useEffect, useCallback } from 'react';
import { useUser, SignInButton, UserButton, useAuth } from '@clerk/clerk-react';

// Stripe price IDs - replace with your actual Stripe price IDs
const STRIPE_PRICES = {
  weekly: 'price_1SZUUxBNLr4e4J9pU0gor6S2',
  monthly: 'price_1SZUVbBNLr4e4J9pzfb15aZo',
  annual: 'price_1SZUwYBNLr4e4J9pu7PYs5BW'
};

// Real handwriting webfonts (loaded via Google Fonts) instead of generic system
// fonts like Comic Sans/Brush Script MT, which don't exist on most platforms and
// silently fall back to a plain sans-serif - shared by Text Mode and Math Mode.
const HANDWRITING_STYLES = {
  text: { fontSize: 42, lineHeight: 60, slant: 0, fontFamily: "'Patrick Hand', cursive", wobble: 1.5, letterSpacing: 1, italic: false },
  journal: { fontSize: 46, lineHeight: 66, slant: 0.02, fontFamily: "'Kalam', cursive", wobble: 3, letterSpacing: 1, italic: false },
  cute: { fontSize: 50, lineHeight: 72, slant: -0.02, fontFamily: "'Shadows Into Light', cursive", wobble: 2.5, letterSpacing: 1, italic: false },
  signature: { fontSize: 52, lineHeight: 78, slant: 0.08, fontFamily: "'Dancing Script', cursive", wobble: 2, letterSpacing: 1, italic: false },
  flashcard: { fontSize: 38, lineHeight: 55, slant: 0, fontFamily: "'Patrick Hand', cursive", wobble: 1, letterSpacing: 1, italic: false },
  cursive: { fontSize: 48, lineHeight: 70, slant: 0.04, fontFamily: "'Homemade Apple', cursive", wobble: 1.5, letterSpacing: 0.5, italic: false }
};

export default function PDFHandwritingConverter() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false);
  const [jsPdfLoaded, setJsPdfLoaded] = useState(false);
  const [penColor, setPenColor] = useState('#1a4d8f');
  const [strokeIntensity, setStrokeIntensity] = useState(2);
  const [paperType, setPaperType] = useState('lined');
  const [activeTab, setActiveTab] = useState('landing');
  const [textMode, setTextMode] = useState('text');
  const [textInput, setTextInput] = useState('');
  const [subscription, setSubscription] = useState({ subscribed: false, plan: null, status: null, stripeCustomerId: null });
  const [conversionsUsed, setConversionsUsed] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [mathHandwritingStyle, setMathHandwritingStyle] = useState('journal');
  const [katexLoaded, setKatexLoaded] = useState(false);
  const [html2canvasLoaded, setHtml2canvasLoaded] = useState(false);

  // Load PDF.js
  useEffect(() => {
    const pdfScript = document.createElement('script');
    pdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    pdfScript.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      setPdfLibLoaded(true);
    };
    document.body.appendChild(pdfScript);

    // Load jsPDF for PDF generation
    const jsPdfScript = document.createElement('script');
    jsPdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    jsPdfScript.onload = () => setJsPdfLoaded(true);
    document.body.appendChild(jsPdfScript);

    // Load KaTeX for rendering transcribed LaTeX math
    const katexCss = document.createElement('link');
    katexCss.rel = 'stylesheet';
    katexCss.href = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css';
    document.head.appendChild(katexCss);

    const katexScript = document.createElement('script');
    katexScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js';
    katexScript.onload = () => setKatexLoaded(true);
    document.body.appendChild(katexScript);

    // Load html2canvas to rasterize the handwritten-font + KaTeX layout
    const html2canvasScript = document.createElement('script');
    html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    html2canvasScript.onload = () => setHtml2canvasLoaded(true);
    document.body.appendChild(html2canvasScript);

    // Load real handwriting fonts (Google Fonts) for authentic-looking output
    const fontsCss = document.createElement('link');
    fontsCss.rel = 'stylesheet';
    fontsCss.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Kalam:wght@400;700&family=Patrick+Hand&family=Shadows+Into+Light&family=Dancing+Script:wght@400;700&family=Homemade+Apple&display=swap';
    document.head.appendChild(fontsCss);

    return () => {
      document.body.removeChild(pdfScript);
      document.body.removeChild(jsPdfScript);
      document.head.removeChild(katexCss);
      document.body.removeChild(katexScript);
      document.body.removeChild(html2canvasScript);
      document.head.removeChild(fontsCss);
    };
  }, []);

  // Fetch subscription status from your backend
  const fetchSubscriptionStatus = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !user) return;

    try {
      const token = await getToken();
      const response = await fetch('/api/subscription/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSubscription({
          subscribed: data.subscribed,
          plan: data.plan,
          status: data.status,
          stripeCustomerId: data.stripeCustomerId
        });
        setConversionsUsed(data.conversionsUsed || 0);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  }, [isLoaded, isSignedIn, user, getToken]);

  useEffect(() => {
    fetchSubscriptionStatus();
  }, [fetchSubscriptionStatus]);

  const handleManageSubscription = async () => {
    if (!subscription.stripeCustomerId) {
      alert('No active subscription found');
      return;
    }

    setCheckoutLoading(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to create portal session');
      
      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Portal error:', error);
      alert('Failed to open billing portal. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCheckout = async (plan) => {
    if (!isSignedIn) {
      alert('Please sign in to subscribe');
      return;
    }

    setCheckoutLoading(true);
    
    try {
      const token = await getToken();
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          priceId: STRIPE_PRICES[plan],
          plan: plan,
          successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}?canceled=true`
        })
      });

      if (!response.ok) throw new Error('Failed to create checkout session');
      
      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const trackConversion = async () => {
    if (!isSignedIn) return;
    
    try {
      const token = await getToken();
      await fetch('/api/conversions/track', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setConversionsUsed(prev => prev + 1);
    } catch (error) {
      console.error('Error tracking conversion:', error);
    }
  };

  const canConvert = () => {
    if (subscription.subscribed) {
      if (subscription.plan === 'starter') return conversionsUsed < 10;
      return true;
    }
    return conversionsUsed < 1;
  };

  const incrementConversions = () => {
    if (!isSignedIn) return;
    trackConversion();
    if (!subscription.subscribed && conversionsUsed >= 0) {
      setShowPaywall(true);
    }
  };

  // Download as PDF
  const downloadAsPDF = async (filename = 'handwritten-document') => {
    if (!jsPdfLoaded || pages.length === 0) {
      alert('PDF library not loaded or no pages to download');
      return;
    }

    setLoading(true);
    setLoadingMessage('Generating PDF...');

    try {
      const { jsPDF } = window.jspdf;
      
      // Get first page dimensions to set PDF size
      const firstPage = pages[0];
      const aspectRatio = firstPage.width / firstPage.height;
      
      // A4 dimensions in mm
      const pdfWidth = 210;
      const pdfHeight = pdfWidth / aspectRatio;
      
      const pdf = new jsPDF({
        orientation: firstPage.width > firstPage.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });

      for (let i = 0; i < pages.length; i++) {
        setLoadingMessage(`Adding page ${i + 1} of ${pages.length}...`);
        
        const page = pages[i];
        const imgData = page.handwritten || page.aiRendered || page.original;
        
        if (i > 0) {
          const pageAspect = page.width / page.height;
          const pageWidth = 210;
          const pageHeight = pageWidth / pageAspect;
          pdf.addPage([pageWidth, pageHeight], page.width > page.height ? 'landscape' : 'portrait');
        }
        
        const currentPageWidth = pdf.internal.pageSize.getWidth();
        const currentPageHeight = pdf.internal.pageSize.getHeight();
        
        pdf.addImage(imgData, 'PNG', 0, 0, currentPageWidth, currentPageHeight, undefined, 'FAST');
      }

      pdf.save(`${filename}.pdf`);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Error generating PDF: ' + error.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  // Download single page as PDF
  const downloadPageAsPDF = async (pageIndex) => {
    if (!jsPdfLoaded) {
      alert('PDF library not loaded');
      return;
    }

    const page = pages[pageIndex];
    const { jsPDF } = window.jspdf;
    
    const aspectRatio = page.width / page.height;
    const pdfWidth = 210;
    const pdfHeight = pdfWidth / aspectRatio;
    
    const pdf = new jsPDF({
      orientation: page.width > page.height ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [pdfWidth, pdfHeight]
    });

    const imgData = page.handwritten || page.aiRendered || page.original;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    pdf.save(`handwritten-page-${pageIndex + 1}.pdf`);
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
      if (!window.confirm(`⚠️ This file is ${(file.size / 1024 / 1024).toFixed(1)}MB. Large files may take longer to process. Continue?`)) {
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
          if (!window.confirm(`⚠️ PDF has ${pdf.numPages} pages. Only the first 20 pages will be extracted for Text Mode. Continue anyway?`)) {
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
          if (!window.confirm(`⚠️ Extracted text is ${allText.length.toLocaleString()} characters. Most content will be cut off. Continue anyway?`)) {
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
          if (!window.confirm(`⚠️ Text file is ${text.length.toLocaleString()} characters. Most will be cut off! Continue anyway?`)) {
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
    
    if (file.size > maxSize) {
      alert('❌ File size exceeds 25MB limit.');
      e.target.value = '';
      return;
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

  // Sends one rendered page image to the backend, which asks Claude to
  // transcribe everything on the page - prose and math alike - into plain
  // text with LaTeX math delimiters ($...$ / $$...$$).
  const transcribePageToLatex = async (pageDataUrl) => {
    const token = await getToken();
    const response = await fetch('/api/convert/page-to-latex', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ imageBase64: pageDataUrl.split(',')[1] })
    });

    if (!response.ok) {
      throw new Error(`Transcription failed (${response.status})`);
    }

    const data = await response.json();
    return data.text || '';
  };

  // Renders transcribed text+LaTeX into a clean image using KaTeX (for real
  // math typesetting) and a genuine handwriting webfont, then rasterizes that
  // layout via html2canvas. This becomes the "ink source" that the existing
  // paper/wobble effect (applyMathHandwriting) draws over, instead of it
  // re-inking the original PDF's digital font.
  // Renders the transcribed text+LaTeX into one tall image, then slices it
  // into page-sized chunks (targetHeight) so a dense source page that needs
  // more room in handwriting than in print spills onto extra pages instead
  // of being squeezed or clipped into a single oversized image.
  const renderLatexPageToImage = async (latexText, targetWidth, targetHeight, styleKey) => {
    if (!window.katex || !window.html2canvas) {
      throw new Error('Handwriting renderer not loaded yet');
    }

    const style = HANDWRITING_STYLES[styleKey];
    const cssWidth = Math.max(300, Math.round(targetWidth / 2.5));

    const segments = [];
    const mathRegex = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
    let lastIndex = 0;
    let match;
    while ((match = mathRegex.exec(latexText)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', value: latexText.slice(lastIndex, match.index) });
      }
      segments.push(match[1] !== undefined
        ? { type: 'display', value: match[1] }
        : { type: 'inline', value: match[2] });
      lastIndex = mathRegex.lastIndex;
    }
    if (lastIndex < latexText.length) {
      segments.push({ type: 'text', value: latexText.slice(lastIndex) });
    }
    if (segments.length === 0) {
      segments.push({ type: 'text', value: latexText });
    }

    const container = document.createElement('div');
    // position: absolute (not fixed) - html2canvas can misplace/clip
    // fixed-positioned elements that sit outside the viewport, which was
    // silently cutting off long transcriptions instead of capturing them.
    container.style.position = 'absolute';
    container.style.left = '-99999px';
    container.style.top = '0';
    container.style.width = `${cssWidth}px`;
    container.style.padding = '48px';
    container.style.boxSizing = 'border-box';
    container.style.background = 'transparent';
    container.style.color = penColor;
    container.style.fontFamily = style.fontFamily;
    container.style.fontSize = `${style.fontSize * 0.55}px`;
    container.style.lineHeight = `${style.lineHeight * 0.55}px`;
    container.style.whiteSpace = 'pre-wrap';
    container.style.wordBreak = 'break-word';

    segments.forEach((seg) => {
      if (seg.type === 'text') {
        const span = document.createElement('span');
        span.textContent = seg.value;
        container.appendChild(span);
      } else {
        const span = document.createElement('span');
        span.style.display = seg.type === 'display' ? 'block' : 'inline-block';
        span.style.margin = seg.type === 'display' ? '10px 0' : '0 2px';
        try {
          span.innerHTML = window.katex.renderToString(seg.value, {
            throwOnError: false,
            displayMode: seg.type === 'display'
          });
        } catch (e) {
          span.textContent = seg.value;
        }
        container.appendChild(span);
      }
    });

    document.body.appendChild(container);

    try {
      await document.fonts.ready;
      // Measure the actual full content height and pass it explicitly -
      // without this, html2canvas guesses a viewport-sized height and
      // silently truncates anything taller than that.
      const fullHeight = Math.ceil(container.scrollHeight);
      const scale = targetWidth / cssWidth;
      const renderedCanvas = await window.html2canvas(container, {
        backgroundColor: null,
        scale,
        width: cssWidth,
        height: fullHeight,
        windowWidth: cssWidth,
        windowHeight: fullHeight
      });

      // If the transcribed content fits within one normal page height,
      // return it as-is. Otherwise slice it into page-sized chunks so long
      // pages spill onto extra sheets instead of rendering as one giant image.
      if (renderedCanvas.height <= targetHeight * 1.05) {
        return [{
          dataUrl: renderedCanvas.toDataURL('image/png'),
          width: renderedCanvas.width,
          height: renderedCanvas.height
        }];
      }

      const slices = [];
      let offsetY = 0;
      while (offsetY < renderedCanvas.height) {
        const sliceHeight = Math.min(targetHeight, renderedCanvas.height - offsetY);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = renderedCanvas.width;
        sliceCanvas.height = sliceHeight;
        const sliceCtx = sliceCanvas.getContext('2d');
        sliceCtx.drawImage(
          renderedCanvas,
          0, offsetY, renderedCanvas.width, sliceHeight,
          0, 0, renderedCanvas.width, sliceHeight
        );
        slices.push({
          dataUrl: sliceCanvas.toDataURL('image/png'),
          width: sliceCanvas.width,
          height: sliceCanvas.height
        });
        offsetY += sliceHeight;
      }
      return slices;
    } finally {
      document.body.removeChild(container);
    }
  };

  const handlePDFUpload = async (file) => {
    if (!canConvert()) {
      setShowPaywall(true);
      return;
    }

    setLoading(true);
    setLoadingMessage('Reading PDF...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      if (pdf.numPages > 50) {
        alert(`⚠️ PDF has ${pdf.numPages} pages. Only the first 50 will be processed.`);
      }

      const loadedPages = [];
      const pagesToProcess = Math.min(pdf.numPages, 50);

      for (let i = 1; i <= pagesToProcess; i++) {
        setLoadingMessage(`Rendering page ${i} of ${pagesToProcess}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        const original = canvas.toDataURL('image/png');

        let rendered = null;
        try {
          setLoadingMessage(`Reading page ${i} of ${pagesToProcess} with AI...`);
          const latexText = await transcribePageToLatex(original);
          if (latexText.trim()) {
            setLoadingMessage(`Typesetting page ${i} of ${pagesToProcess}...`);
            rendered = await renderLatexPageToImage(latexText, viewport.width, viewport.height, mathHandwritingStyle);
          }
        } catch (err) {
          console.error(`AI transcription failed for page ${i}:`, err);
        }

        if (rendered && rendered.length > 0) {
          // A source page's transcription may need more than one handwritten
          // page - push each slice as its own page, all falling back to the
          // same original scan if the ink effect needs it.
          rendered.forEach((slice) => {
            loadedPages.push({
              original,
              aiRendered: slice.dataUrl,
              handwritten: null,
              width: slice.width,
              height: slice.height
            });
          });
        } else {
          loadedPages.push({
            original,
            aiRendered: null,
            handwritten: null,
            width: viewport.width,
            height: viewport.height
          });
        }
      }
      setPages(loadedPages);
      incrementConversions();
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
      
      lines.slice(0, maxLines).forEach(line => {
        ctx.fillText(line, 100, y);
        y += 60;
      });
      
      setPages([{
        original: canvas.toDataURL('image/png'),
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
          alert('❌ Error loading image.');
          setLoading(false);
          setLoadingMessage('');
          resolve();
        };
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          
          setPages([{
            original: canvas.toDataURL('image/png'),
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
      ctx.globalAlpha = 1;
    }
  };

  const convertTextToHandwriting = async () => {
    if (!canConvert()) {
      setShowPaywall(true);
      return;
    }

    if (!textInput.trim()) {
      alert('Please enter some text or upload a file!');
      return;
    }

    const charCount = textInput.length;

    if (charCount > 15000) {
      if (!window.confirm(`⚠️ Your text is ${charCount.toLocaleString()} characters. Most content will be cut off! Continue anyway?`)) {
        return;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = 2100;
    canvas.height = 2970;
    const ctx = canvas.getContext('2d');

    createPaperTexture(ctx, canvas.width, canvas.height, paperType);

    const { fontSize, lineHeight, slant, fontFamily, wobble, letterSpacing, italic } = HANDWRITING_STYLES[textMode];

    // Make sure the webfont is actually loaded before drawing - otherwise the
    // canvas silently falls back to a generic sans-serif on first use.
    try {
      await document.fonts.load(`${italic ? 'italic' : 'normal'} ${fontSize}px ${fontFamily}`);
    } catch (e) { /* font API not supported - fall back to default rendering */ }

    ctx.font = `${italic ? 'italic' : 'normal'} ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';
    
    const words = textInput.split(/\s+/).filter(word => word.length > 0);
    
    let x = 100, y = 100;
    const maxWidth = canvas.width - 200;
    
    words.forEach((word) => {
      const metrics = ctx.measureText(word + ' ');
      
      if (x + metrics.width > maxWidth) {
        x = 100;
        y += lineHeight + Math.random() * 5;
      }
      
      if (y > canvas.height - 150) return;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.transform(1, slant, 0, 1, 0, 0);
      
      ctx.fillStyle = penColor;
      ctx.globalAlpha = 0.85 + Math.random() * 0.15;
      ctx.fillText(word, (Math.random() - 0.5) * wobble, (Math.random() - 0.5) * wobble);
      
      ctx.restore();
      
      x += metrics.width + letterSpacing;
    });
    
    setPages([{
      original: canvas.toDataURL('image/png'),
      handwritten: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height
    }]);
    incrementConversions();
  };

  const applyMathHandwriting = (pageIndex) => {
    return new Promise((resolve) => {
      const page = pages[pageIndex];
      if (!page || !page.original) {
        alert('❌ Error: Page data not found');
        resolve(false);
        return;
      }

      const img = new Image();
      img.onerror = () => {
        alert('❌ Error loading image.');
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
          // Scale-to-fit: the AI-rendered source (page.aiRendered) is rasterized
          // at its own natural content size, which may not exactly match
          // page.width/page.height, so draw it stretched to the target canvas.
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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
          newPages[pageIndex].handwritten = canvas.toDataURL('image/png');
          setPages(newPages);

          resolve(true);
        } catch (error) {
          alert('❌ Error processing image: ' + error.message);
          resolve(false);
        }
      };

      img.src = page.aiRendered || page.original;
    });
  };

  // The paid step is the AI transcription done at upload time (see
  // handlePDFUpload) - re-applying the ink/paper effect afterward is a free,
  // local, repeatable re-styling pass, so it isn't gated behind canConvert().
  const applyToAll = async () => {
    setLoading(true);
    for (let i = 0; i < pages.length; i++) {
      setLoadingMessage(`Converting page ${i + 1} of ${pages.length}...`);
      await applyMathHandwriting(i);
    }
    setLoading(false);
    setLoadingMessage('');
  };

  const handleApplyStrokesClick = async (pageIndex) => {
    setLoading(true);
    setLoadingMessage(`Processing page ${pageIndex + 1}...`);
    await applyMathHandwriting(pageIndex);
    setLoading(false);
    setLoadingMessage('');
  };

  const removePage = (pageIndex) => {
    const newPages = pages.filter((_, index) => index !== pageIndex);
    setPages(newPages);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white">
     <header className="border-b border-gray-800 backdrop-blur-sm bg-black/50 sticky top-0 z-40">
  <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">

    <div
      className="flex items-center gap-3 cursor-pointer"
      onClick={() => setActiveTab('landing')}
    >
      <img
        src="/logo.png"
        alt="MatHandWrite logo"
        className="w-10 h-10 rounded-lg object-contain"
      />

      <div className="flex flex-col">
        <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          MatHandWrite
        </span>
        <span className="text-xs text-gray-400">
          Convert math & notes into handwriting
        </span>
      </div>
    </div>

    <div>
      {isSignedIn ? (
        <div className="flex items-center gap-3">
          {subscription.subscribed && (
            <button
              onClick={handleManageSubscription}
              disabled={checkoutLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-all disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm font-medium hidden sm:inline">Manage Plan</span>
            </button>
          )}
          <UserButton afterSignOutUrl="/" />
        </div>
      ) : (
        <div className="flex gap-3">
          <SignInButton mode="modal">
            <button className="px-5 py-2 text-gray-300 hover:text-white transition-colors font-medium">
              Sign In
            </button>
          </SignInButton>
          <SignInButton mode="modal">
            <button className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-lg font-medium transition-all shadow-lg shadow-blue-500/20">
              Get Started
            </button>
          </SignInButton>
        </div>
      )}
    </div>

  </div>
</header>

      {activeTab === 'landing' && (
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center space-y-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-sm text-blue-400 mb-4">
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
              No LaTeX Required • 6 Handwriting Styles • Math & Text Modes • Instant PDF Download
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
              <div onClick={() => { if (!isSignedIn) { alert('Please sign in to continue'); return; } setActiveTab('math'); }} className="cursor-pointer bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-blue-500 rounded-3xl p-10 hover:scale-105 transition-all hover:shadow-2xl hover:shadow-blue-500/20">
                <div className="text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <span className="text-6xl">🧮</span>
                  </div>
                  <h2 className="text-3xl font-bold mb-4">Math Mode</h2>
                  <p className="text-gray-400 text-lg mb-4">Upload PDFs with equations, formulas, and mathematical notation. AI reads every page, rebuilds it in LaTeX, and typesets it by hand.</p>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full text-xs text-green-400 mb-4">
                    <span>✓</span>
                    No LaTeX Required - Just Upload PDF
                  </div>
                  <div className="inline-block px-6 py-3 bg-blue-600 rounded-xl font-semibold mt-2 w-full">
                    Start with Math Mode →
                  </div>
                </div>
              </div>

              <div onClick={() => { if (!isSignedIn) { alert('Please sign in to continue'); return; } setActiveTab('text'); }} className="cursor-pointer bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-purple-500 rounded-3xl p-10 hover:scale-105 transition-all hover:shadow-2xl hover:shadow-purple-500/20">
                <div className="text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <span className="text-6xl">📝</span>
                  </div>
                  <h2 className="text-3xl font-bold mb-4">Text Modes</h2>
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
                <span>AI-Powered LaTeX Transcription</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>Download as PDF</span>
              </div>
            </div>

            <section className="pt-20 border-t border-gray-800">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-4xl font-bold text-center mb-4">Transform Your Digital Math Notes Into Authentic Handwriting</h2>
                <p className="text-center text-gray-400 text-lg mb-12">The only tool that reads your typed math PDFs with AI, rebuilds every formula in LaTeX, and typesets the whole page in genuine handwriting</p>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/30 border border-blue-500/20 rounded-2xl p-8 hover:border-blue-500/40 transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">📐</span>
                      <h3 className="text-2xl font-bold">AI-Read, LaTeX-Typeset</h3>
                    </div>
                    <p className="text-gray-300 mb-4">Claude reads your whole document and transcribes it into LaTeX, so equations are properly typeset - not just re-inked pixels.</p>
                    <ul className="space-y-2 text-sm text-gray-400">
                      <li className="flex items-center gap-2"><span className="text-blue-400">→</span> Complex formulas stay intact</li>
                      <li className="flex items-center gap-2"><span className="text-blue-400">→</span> Graphs and diagrams preserved perfectly</li>
                      <li className="flex items-center gap-2"><span className="text-blue-400">→</span> Scientific notation & symbols unchanged</li>
                    </ul>
                  </div>

                  <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/30 border border-purple-500/20 rounded-2xl p-8 hover:border-purple-500/40 transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">✍️</span>
                      <h3 className="text-2xl font-bold">6 Authentic Styles</h3>
                    </div>
                    <p className="text-gray-300 mb-4">Choose from multiple handwriting styles that look genuinely written by hand, not generated.</p>
                    <ul className="space-y-2 text-sm text-gray-400">
                      <li className="flex items-center gap-2"><span className="text-purple-400">→</span> Clean readable • Journal natural • Cute bubbly</li>
                      <li className="flex items-center gap-2"><span className="text-purple-400">→</span> Signature elegant • Flashcard compact • Cursive flowing</li>
                      <li className="flex items-center gap-2"><span className="text-purple-400">→</span> Customize pen color & paper texture</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-8 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-8">
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-blue-400 mb-2">AI</p>
                      <p className="text-gray-300">Full-Page Transcription</p>
                      <p className="text-sm text-gray-500 mt-1">Reads text and math together</p>
                    </div>
                    <div className="text-center">
                      <p className="text-4xl font-bold text-purple-400 mb-2">100%</p>
                      <p className="text-gray-300">Authentic Look</p>
                      <p className="text-sm text-gray-500 mt-1">Genuinely handwritten appearance</p>
                    </div>
                    <div className="text-center">
                      <p className="text-4xl font-bold text-pink-400 mb-2">1/10</p>
                      <p className="text-gray-300">Minutes to Complete</p>
                      <p className="text-sm text-gray-500 mt-1">Instant PDF download</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 text-center">
                  <h3 className="text-2xl font-bold mb-4">Perfect For</h3>
                  <div className="flex flex-wrap justify-center gap-3 mb-6">
                    <span className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-300 text-sm font-medium">Calculus homework</span>
                    <span className="px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-sm font-medium">Physics problem sets</span>
                    <span className="px-4 py-2 bg-pink-500/20 border border-pink-500/30 rounded-full text-pink-300 text-sm font-medium">Typed lecture notes</span>
                    <span className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-full text-cyan-300 text-sm font-medium">Math exams</span>
                    <span className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full text-green-300 text-sm font-medium">Research papers</span>
                    <span className="px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-full text-orange-300 text-sm font-medium">Study materials</span>
                  </div>
                  <button onClick={() => { if (!isSignedIn) { alert('Please sign in to continue'); return; } setActiveTab('math'); }} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/20">
                    Convert Your First PDF Now →
                  </button>
                </div>
              </div>
            </section>
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
                  placeholder="Type or paste your text here..."
                  className="w-full h-64 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-white resize-none"
                />
                <div className="text-right mt-2">
                  <span className={`text-sm font-medium ${textInput.length > 15000 ? 'text-red-500' : textInput.length > 8000 ? 'text-orange-400' : textInput.length > 5000 ? 'text-yellow-400' : 'text-gray-500'}`}>
                    {textInput.length.toLocaleString()} characters
                  </span>
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
              <div className="max-w-md mx-auto text-left">
                <label className="block text-sm font-medium text-gray-300 mb-2">✍️ Handwriting Style</label>
                <select value={mathHandwritingStyle} onChange={(e) => setMathHandwritingStyle(e.target.value)} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-white">
                  <option value="text">📝 Clean & Readable</option>
                  <option value="journal">📔 Journal (Natural & Casual)</option>
                  <option value="cute">💕 Cute Aesthetic (Bubbly)</option>
                  <option value="signature">✒️ Signature (Elegant & Slanted)</option>
                  <option value="flashcard">🗂️ Flashcard (Compact & Clear)</option>
                  <option value="cursive">🖋️ Cursive (Flowing)</option>
                </select>
                <p className="text-xs text-gray-500 mt-2">Applies to PDF uploads - the AI transcribes the page, then typesets it in this style.</p>
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
                  <input type="file" accept="application/pdf,text/*,image/*" onChange={handleFileUpload} disabled={!pdfLibLoaded || !katexLoaded || !html2canvasLoaded || loading} className="hidden" />
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✨</span>
          <span className="text-sm">
            <strong>{subscription.plan === 'weekly' ? 'Weekly' : subscription.plan === 'annual' ? 'Annual' : 'Monthly'} Plan Active</strong> - Unlimited documents
          </span>
        </div>
        <button 
          onClick={handleManageSubscription} 
          disabled={checkoutLoading}
          className="px-5 py-2 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
        >
          {checkoutLoading ? 'Loading...' : 'Manage Subscription'}
        </button>
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
              <button onClick={() => downloadAsPDF('handwritten-document')} disabled={loading || !jsPdfLoaded} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 rounded-xl font-medium transition-all shadow-lg shadow-green-500/20 ml-auto disabled:opacity-50">
                <span>📄</span>
                Download PDF
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
                    <button onClick={() => downloadPageAsPDF(index)} disabled={!jsPdfLoaded} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
                      <span>📄</span>
                      Download PDF
                    </button>
                    <button onClick={() => removePage(index)} className="flex items-center gap-2 px-5 py-2.5 bg-red-600/20 border border-red-500 hover:bg-red-600/30 rounded-lg text-sm font-medium transition-all">
                      <span>🗑️</span>
                      Remove
                    </button>
                  </div>
                </div>
                <div className="border-2 border-gray-700 rounded-xl overflow-hidden bg-gray-900">
                  <img src={page.handwritten || page.aiRendered || page.original} alt={`Page ${index + 1}`} className="w-full" />
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
            <button onClick={() => downloadAsPDF('handwritten-text')} disabled={!jsPdfLoaded} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 rounded-xl font-medium transition-all shadow-lg shadow-green-500/20 disabled:opacity-50">
              <span>📄</span>
              Download PDF
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
            <p className="text-gray-400 text-lg">{loadingMessage || 'Processing...'}</p>
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
                  <li>✓ PDF downloads</li>
                  <li>✓ Cancel anytime</li>
                </ul>
                <button onClick={() => handleCheckout('weekly')} disabled={checkoutLoading} className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-all disabled:opacity-50">
                  {checkoutLoading ? 'Loading...' : 'Get Weekly'}
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
                  <li>✓ Best value per month</li>
                </ul>
                <button onClick={() => handleCheckout('monthly')} disabled={checkoutLoading} className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-medium transition-all shadow-lg shadow-purple-500/30 disabled:opacity-50">
                  {checkoutLoading ? 'Loading...' : 'Get Monthly'}
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
                  <li>✓ Biggest savings</li>
                  <li>✓ All future updates</li>
                </ul>
                <button onClick={() => handleCheckout('annual')} disabled={checkoutLoading} className="w-full px-6 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-medium transition-all disabled:opacity-50">
                  {checkoutLoading ? 'Loading...' : 'Get Annual'}
                </button>
              </div>
            </div>

            <button onClick={() => setShowPaywall(false)} className="text-gray-400 hover:text-white text-sm underline mx-auto block">
              Close
            </button>
          </div>
        </div>
      )}
         <footer className="border-t border-gray-800 bg-black/50 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="MatHandWrite logo"
                className="w-8 h-8 rounded-lg object-contain"
              />
              <div className="text-sm text-gray-400">
                © 2025 MatHandWrite. All rights reserved.
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <a 
                href="/privacy-policy.html" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Privacy Policy
              </a>
              <a 
                href="mailto:support@mathandwrite.com"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Contact Support
              </a>
            </div>

          </div>
        </div>
      </footer>
      {/* ========== END FOOTER ========== */}

    </div>
  );
}
