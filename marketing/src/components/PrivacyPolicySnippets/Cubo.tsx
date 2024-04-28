import React from 'react'
import Redacted from '../Redacted'

// https://au.getcubo.com/pages/privacy-policy

const Cubo = () => {
    return (
        <blockquote className="blockquote fs-6">
            <h4 className="card-subtitle">
                Storage period
            </h4>
            <p>
                Photos taken by <Redacted />'s Auto Photo Capture regularly, the environmental
                information, and the analysis results from <Redacted /> will be uploaded to our
                servers; we will continue to store the data above before you request us to
                delete it.
            </p>
            <footer className="blockquote-footer">
                <cite>Creepy Baby Monitor Privacy Policy</cite>
            </footer>
        </blockquote>
    )
}

export default Cubo