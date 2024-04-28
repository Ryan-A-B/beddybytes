import React from "react";
import Navbar from "../Navbar";

interface Props {
    children: React.ReactNode;
}

const DefaultPageWrapper: React.FunctionComponent<Props> = ({ children }) => (
    <React.Fragment>
        <Navbar />
        <main id="main" className="container">
            {children}
        </main>
    </React.Fragment>
)

export default DefaultPageWrapper;