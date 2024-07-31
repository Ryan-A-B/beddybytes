import React from "react";
import CallToActionSection from "../CallToActionSection";
import Navbar from "./Navbar";
import Footer from "./Footer";

import "./style.scss"

interface Props {
    without_call_to_action_section?: boolean
    children: React.ReactNode;
}

const DefaultPageWrapper: React.FunctionComponent<Props> = ({ without_call_to_action_section = false, children }) => (
    <React.Fragment>
        <div className="wrapper">
            <Navbar />
            <div className="wrapper-body">
                <div className="wrapper-content">
                    {children}
                </div>
                {!without_call_to_action_section && <CallToActionSection />}
                <Footer />
            </div>
        </div>
    </React.Fragment>
)

export default DefaultPageWrapper;