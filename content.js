/**
 * NJU Captcha Auto-Fill - Content Script
 * Automatically recognizes and fills the captcha on NJU authentication page.
 */

(async function () {
  'use strict';

  // ============ DEBUG MODE ============
  const DEBUG = true;
  
  function log(...args) {
    if (DEBUG) console.log('[NJU Captcha]', ...args);
  }
  
  function warn(...args) {
    console.warn('[NJU Captcha]', ...args);
  }
  
  function error(...args) {
    console.error('[NJU Captcha]', ...args);
  }

  // ============ CONFIGURATION ============
  const CONFIG = {
    characters: ['1', '2', '3', '4', '5', '6', '7', '8', 'a', 'b', 'c', 'd', 'e', 'f', 'h', 'k', 'n', 'p', 'q', 'x', 'y', 'z'],
    resizeWidth: 176,
    resizeHeight: 64,
    captchaLength: 4,
    numClasses: 22,
    mean: [0.743, 0.7432, 0.7431],
    std: [0.1917, 0.1918, 0.1917],
  };

  log('Extension loaded, CONFIG:', CONFIG);

  // ============ ONNX SESSION ============
  let session = null;
  let isLoading = false;
  let loadError = null;

  /**
   * Initialize ONNX Runtime session
   */
  async function initSession() {
    if (session) {
      log('Session already initialized');
      return session;
    }
    
    if (isLoading) {
      log('Session is loading, waiting...');
      // Wait for loading to complete
      while (isLoading) {
        await new Promise(r => setTimeout(r, 100));
      }
      return session;
    }
    
    isLoading = true;
    log('Starting to load ONNX model...');
    
    try {
      // Check if ort is available
      if (typeof ort === 'undefined') {
        throw new Error('ONNX Runtime (ort) is not loaded! Check if ort.min.js is included.');
      }
      log('ONNX Runtime version:', ort.env?.versions?.web || 'unknown');
      
      // Set WASM paths - CRITICAL for ONNX Runtime Web to work
      // Use CDN for WASM files since they're not bundled
      // Must match the version of ort.min.js (1.17.0)
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/';
      log('WASM paths set to:', ort.env.wasm.wasmPaths);
      
      // Get model URL from extension
      const modelUrl = chrome.runtime.getURL('nju_captcha.onnx');
      log('Model URL:', modelUrl);
      
      // Fetch model data
      log('Fetching model...');
      const response = await fetch(modelUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch model: HTTP ${response.status}`);
      }
      
      const modelData = await response.arrayBuffer();
      log('Model fetched, size:', modelData.byteLength, 'bytes');
      
      // Create session with WASM backend
      log('Creating ONNX inference session...');
      session = await ort.InferenceSession.create(modelData, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      
      log('Model loaded successfully!');
      log('Input names:', session.inputNames);
      log('Output names:', session.outputNames);
      
      isLoading = false;
      return session;
    } catch (err) {
      error('Failed to load model:', err);
      loadError = err;
      isLoading = false;
      return null;
    }
  }

  /**
   * Preprocess image for model inference
   */
  function preprocessImage(imageElement) {
    log('Preprocessing image...');
    log('Image dimensions:', imageElement.naturalWidth, 'x', imageElement.naturalHeight);
    log('Image complete:', imageElement.complete);
    log('Image src:', imageElement.src?.substring(0, 100) + '...');
    
    // Create canvas for resizing
    const canvas = document.createElement('canvas');
    canvas.width = CONFIG.resizeWidth;
    canvas.height = CONFIG.resizeHeight;
    const ctx = canvas.getContext('2d');
    
    // Draw resized image
    ctx.drawImage(imageElement, 0, 0, CONFIG.resizeWidth, CONFIG.resizeHeight);
    
    // Get image data
    let imageData;
    try {
      imageData = ctx.getImageData(0, 0, CONFIG.resizeWidth, CONFIG.resizeHeight);
    } catch (err) {
      error('Failed to get image data (possibly CORS issue):', err);
      throw err;
    }
    
    const { data } = imageData;
    log('Image data length:', data.length);
    
    // Check if image data is valid (not all zeros)
    let nonZeroCount = 0;
    for (let i = 0; i < Math.min(1000, data.length); i++) {
      if (data[i] !== 0) nonZeroCount++;
    }
    log('Non-zero pixels in first 1000:', nonZeroCount);
    
    if (nonZeroCount === 0) {
      warn('Image appears to be empty or not loaded properly');
    }
    
    // Convert to float32 tensor with normalization
    // Format: CHW (channels first)
    const float32Data = new Float32Array(3 * CONFIG.resizeHeight * CONFIG.resizeWidth);
    
    for (let i = 0; i < CONFIG.resizeHeight * CONFIG.resizeWidth; i++) {
      const r = data[i * 4] / 255.0;
      const g = data[i * 4 + 1] / 255.0;
      const b = data[i * 4 + 2] / 255.0;
      
      // Normalize and store in CHW format
      float32Data[i] = (r - CONFIG.mean[0]) / CONFIG.std[0];
      float32Data[i + CONFIG.resizeHeight * CONFIG.resizeWidth] = (g - CONFIG.mean[1]) / CONFIG.std[1];
      float32Data[i + 2 * CONFIG.resizeHeight * CONFIG.resizeWidth] = (b - CONFIG.mean[2]) / CONFIG.std[2];
    }
    
    log('Preprocessed tensor size:', float32Data.length);
    log('Sample values (first 5):', Array.from(float32Data.slice(0, 5)));
    
    return float32Data;
  }

  /**
   * Run inference on preprocessed image
   */
  async function runInference(float32Data) {
    log('Running inference...');
    
    const inferenceSession = await initSession();
    if (!inferenceSession) {
      throw new Error('Model not loaded: ' + (loadError?.message || 'unknown error'));
    }
    
    // Create input tensor
    const inputTensor = new ort.Tensor(
      'float32',
      float32Data,
      [1, 3, CONFIG.resizeHeight, CONFIG.resizeWidth]
    );
    log('Input tensor shape:', inputTensor.dims);
    
    // Run inference
    const startTime = performance.now();
    const results = await inferenceSession.run({ input: inputTensor });
    const inferenceTime = performance.now() - startTime;
    log('Inference time:', inferenceTime.toFixed(2), 'ms');
    
    const outputData = results.output.data;
    log('Output tensor shape:', results.output.dims);
    log('Output data length:', outputData.length);
    
    // Decode output: shape is [1, 4, 22]
    let text = '';
    for (let i = 0; i < CONFIG.captchaLength; i++) {
      const startIdx = i * CONFIG.numClasses;
      const endIdx = startIdx + CONFIG.numClasses;
      const scores = Array.from(outputData.slice(startIdx, endIdx));
      
      // Find max score index
      let maxIdx = 0;
      let maxScore = scores[0];
      for (let j = 1; j < scores.length; j++) {
        if (scores[j] > maxScore) {
          maxScore = scores[j];
          maxIdx = j;
        }
      }
      
      log(`Position ${i}: maxIdx=${maxIdx}, char='${CONFIG.characters[maxIdx]}', score=${maxScore.toFixed(4)}`);
      text += CONFIG.characters[maxIdx];
    }
    
    log('Decoded text:', text);
    return text;
  }

  /**
   * Process captcha image and fill the input
   */
  async function processCaptcha(imgElement) {
    log('========== Processing captcha ==========');
    
    try {
      // Check image validity
      if (!imgElement) {
        throw new Error('Image element is null');
      }
      
      if (!imgElement.complete) {
        log('Image not complete, waiting...');
        await new Promise((resolve, reject) => {
          imgElement.onload = resolve;
          imgElement.onerror = () => reject(new Error('Image failed to load'));
          setTimeout(() => reject(new Error('Image load timeout')), 5000);
        });
      }
      
      if (imgElement.naturalWidth === 0 || imgElement.naturalHeight === 0) {
        throw new Error('Image has zero dimensions');
      }
      
      // Preprocess image
      const inputData = preprocessImage(imgElement);
      
      // Run inference
      const captchaText = await runInference(inputData);
      log('Recognition result:', captchaText);
      
      // Fill the input field
      const inputField = document.querySelector('#captchaResponse');
      log('Input field found:', !!inputField);
      
      if (inputField) {
        inputField.value = captchaText;
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
        inputField.dispatchEvent(new Event('change', { bubbles: true }));
        log('Captcha filled successfully!');
      } else {
        warn('Input field #captchaResponse not found');
        // Try alternative selectors
        const altInput = document.querySelector('input[name="captchaResponse"]') || 
                         document.querySelector('input[placeholder*="验证码"]');
        if (altInput) {
          altInput.value = captchaText;
          altInput.dispatchEvent(new Event('input', { bubbles: true }));
          log('Filled alternative input field');
        }
      }
      
      log('========== Processing complete ==========');
    } catch (err) {
      error('Error processing captcha:', err);
      error('Stack trace:', err.stack);
    }
  }

  /**
   * Wait for element to appear
   */
  function waitForElement(selector, callback, timeout = 10000) {
    log('Waiting for element:', selector);
    
    const element = document.querySelector(selector);
    if (element) {
      log('Element found immediately:', selector);
      callback(element);
      return;
    }
    
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        log('Element found via MutationObserver:', selector);
        obs.disconnect();
        callback(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    
    // Timeout
    setTimeout(() => {
      observer.disconnect();
      warn('Timeout waiting for element:', selector);
    }, timeout);
  }

  /**
   * Setup image observer for captcha refresh
   */
  function setupImageObserver(img) {
    log('Setting up image observer for captcha refresh');
    
    // Method 1: Listen for click (user clicks to refresh)
    img.addEventListener('click', () => {
      log('Image clicked, will reprocess after load');
      setTimeout(() => {
        const newImg = document.querySelector('#captchaImg');
        if (newImg) {
          if (newImg.complete && newImg.naturalHeight !== 0) {
            processCaptcha(newImg);
          } else {
            newImg.addEventListener('load', () => processCaptcha(newImg), { once: true });
          }
        }
      }, 300);
    });
    
    // Method 2: Watch for src attribute changes
    const srcObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
          log('Image src changed, will reprocess');
          const target = mutation.target;
          if (target.complete && target.naturalHeight !== 0) {
            processCaptcha(target);
          } else {
            target.addEventListener('load', () => processCaptcha(target), { once: true });
          }
        }
      }
    });
    
    srcObserver.observe(img, { attributes: true, attributeFilter: ['src'] });
  }

  /**
   * Main entry point
   */
  async function main() {
    log('========================================');
    log('NJU Captcha Auto-Fill Extension Started');
    log('URL:', window.location.href);
    log('========================================');
    
    // Start loading model in background
    initSession().then(s => {
      if (s) {
        log('Background model loading completed');
      } else {
        error('Background model loading failed');
      }
    });
    
    // Wait for captcha image
    waitForElement('#captchaImg', async (img) => {
      log('Captcha image element found');
      log('Image element:', img);
      log('Image src:', img.src);
      log('Image complete:', img.complete);
      log('Image naturalWidth:', img.naturalWidth);
      log('Image naturalHeight:', img.naturalHeight);
      
      // Setup observer for future refreshes
      setupImageObserver(img);
      
      // Process current image
      if (img.complete && img.naturalHeight !== 0) {
        log('Image already loaded, processing immediately');
        await processCaptcha(img);
      } else {
        log('Image not yet loaded, waiting for load event');
        img.addEventListener('load', () => {
          log('Image load event fired');
          processCaptcha(img);
        }, { once: true });
        
        img.addEventListener('error', (e) => {
          error('Image load error:', e);
        }, { once: true });
      }
    });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    log('Document still loading, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', main);
  } else {
    log('Document already loaded, running main immediately');
    main();
  }
})();
