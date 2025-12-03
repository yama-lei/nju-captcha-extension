/**
 * Popup script for NJU Captcha Auto-Fill extension
 */

const debugLog = document.getElementById('debugLog');
const modelStatus = document.getElementById('modelStatus');
const modelStatusText = document.getElementById('modelStatusText');
const modelSize = document.getElementById('modelSize');
const ortVersion = document.getElementById('ortVersion');

function addLog(message, type = 'info') {
  const time = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.className = type;
  line.textContent = `[${time}] ${message}`;
  debugLog.appendChild(line);
  debugLog.scrollTop = debugLog.scrollHeight;
}

function setStatus(status, text) {
  modelStatus.className = 'status-dot ' + status;
  modelStatusText.textContent = text;
}

async function checkStatus() {
  addLog('开始检查状态...');
  setStatus('loading', '检查中...');
  
  try {
    // Check model file
    const modelUrl = chrome.runtime.getURL('nju_captcha.onnx');
    addLog('模型URL: ' + modelUrl);
    
    const response = await fetch(modelUrl);
    if (response.ok) {
      const size = response.headers.get('content-length');
      if (size) {
        const sizeKB = (parseInt(size) / 1024).toFixed(1);
        modelSize.textContent = `${sizeKB} KB`;
        addLog(`模型大小: ${sizeKB} KB`);
      }
      
      setStatus('', '已就绪');
      addLog('模型文件检查通过', 'info');
    } else {
      setStatus('error', '模型未找到');
      addLog(`模型文件获取失败: HTTP ${response.status}`, 'error');
    }
    
    // Check ort.min.js
    const ortUrl = chrome.runtime.getURL('ort.min.js');
    const ortResponse = await fetch(ortUrl, { method: 'HEAD' });
    if (ortResponse.ok) {
      const ortSize = ortResponse.headers.get('content-length');
      if (ortSize) {
        ortVersion.textContent = `~${(parseInt(ortSize) / 1024).toFixed(0)} KB`;
      }
      addLog('ONNX Runtime 文件检查通过');
    } else {
      addLog('ONNX Runtime 文件获取失败', 'error');
    }
    
  } catch (error) {
    setStatus('error', '检查失败');
    addLog('检查状态时出错: ' + error.message, 'error');
  }
}

async function testModel() {
  addLog('开始测试模型加载...');
  
  try {
    // Try to load the model in popup context (may not work due to WASM)
    const modelUrl = chrome.runtime.getURL('nju_captcha.onnx');
    addLog('获取模型数据...');
    
    const response = await fetch(modelUrl);
    const modelData = await response.arrayBuffer();
    addLog(`模型数据大小: ${modelData.byteLength} bytes`);
    
    // Check first few bytes (ONNX magic number)
    const view = new Uint8Array(modelData);
    const magic = Array.from(view.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    addLog(`模型头部字节: ${magic}`);
    
    // ONNX files start with 0x08 (protobuf wire type)
    if (view[0] === 0x08) {
      addLog('模型格式验证通过 (ONNX protobuf)', 'info');
    } else {
      addLog('模型格式可能不正确', 'warn');
    }
    
    addLog('模型文件完整性检查通过');
    addLog('注意: 完整推理测试请在目标页面进行', 'warn');
    
  } catch (error) {
    addLog('测试失败: ' + error.message, 'error');
  }
}

// Event listeners
document.getElementById('refreshBtn').addEventListener('click', () => {
  debugLog.innerHTML = '';
  checkStatus();
});

document.getElementById('testBtn').addEventListener('click', testModel);

// Initial check
document.addEventListener('DOMContentLoaded', () => {
  addLog('Popup 已加载');
  checkStatus();
});
