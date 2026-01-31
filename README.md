# YOLO Vision 2.0

**Browser-based real-time object detection using TensorFlow.js**

No server required. Runs entirely in your browser. Deploy to GitHub Pages.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- 🎥 **Real-time webcam detection** - Uses your browser's camera
- 🧠 **TensorFlow.js COCO-SSD** - 80 object classes
- 🎨 **Customizable visualization** - Fill, outline, colors, opacity
- ⌨️ **Keyboard presets** - Quick style switching (E, R, T, Z, U, I, O)
- 📱 **Responsive design** - Works on desktop and mobile
- 🚀 **Zero backend** - 100% client-side

## Quick Start

### Local Development

```bash
cd v2
python3 -m http.server 8888
# Open http://localhost:8888
```

Or with Node.js:
```bash
npx serve .
```

### GitHub Pages Deployment

1. Push the `v2` folder to your repository
2. Go to **Settings → Pages**
3. Select branch and folder `/v2`
4. Your app will be live at `https://username.github.io/repo/v2/`

Alternatively, create a `gh-pages` branch with just the v2 contents.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Start/Stop camera |
| `S` | Toggle settings panel |
| `F` | Toggle fullscreen |
| `E` | Neon preset |
| `R` | Red Alert preset |
| `T` | Matrix preset |
| `Z` | Cyberpunk preset |
| `U` | Clean White preset |
| `I` | Dark Mode preset |
| `O` | Orange preset |

## Browser Requirements

- Modern browser with webcam support (Chrome, Firefox, Safari, Edge)
- Camera permissions must be granted
- WebGL for TensorFlow.js acceleration

## Technology Stack

- **TensorFlow.js** - Machine learning in the browser
- **COCO-SSD** - Pre-trained object detection model
- **MediaDevices API** - Webcam access
- **Canvas API** - Real-time rendering
- **Vanilla JS/CSS** - No build tools required

## Project Structure

```
v2/
├── index.html      # Main HTML with UI
├── app.js          # Application controller
├── detector.js     # TensorFlow.js detection wrapper
├── renderer.js     # Canvas rendering engine
├── styles.css      # Premium dark theme
└── README.md       # This file
```

## Comparison with v1

| Feature | v1 (Python) | v2 (Browser) |
|---------|-------------|--------------|
| Requires server | ✅ Yes | ❌ No |
| Model | YOLOv8/11 | COCO-SSD |
| Segmentation | ✅ Pixel masks | 🔲 Bounding boxes |
| Hosting | Local only | GitHub Pages |
| Performance | ~30 FPS | ~20-30 FPS |

## License

MIT License - Feel free to use and modify.
