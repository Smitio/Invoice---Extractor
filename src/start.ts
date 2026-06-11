import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getRouter } from './router' 
import './styles.css'

const rootElement = document.getElementById('root')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(RouterProvider, { router: getRouter() })
    )
  )
}
