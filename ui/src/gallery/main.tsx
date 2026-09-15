import React from 'react'
import ReactDOM from 'react-dom/client'
import { GalleryPages } from './GalleryPages'
import '../styles.css'
import './gallery.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <GalleryPages />
  </React.StrictMode>
)
