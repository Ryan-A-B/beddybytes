import React from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

import "./style.scss"

interface Props {
    children: React.ReactNode;
}

const DefaultPageWrapper: React.FunctionComponent<Props> = ({ children }) => (
    <React.Fragment>
        <div className="wrapper">
            <Navbar />
            <div className="wrapper-body">
                <div className="wrapper-content">
                    {children}
                </div>
                <Footer />
            </div>
        </div>
    </React.Fragment>
)

export default DefaultPageWrapper;