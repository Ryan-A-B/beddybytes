import React from "react";
import CallToActionSection from "../CallToActionSection";
import Navbar from "./Navbar";
import Footer from "./Footer";

import "./style.scss"

interface Props {
    include_call_to_action_section?: boolean
    children: React.ReactNode;
}

const DefaultPageWrapper: React.FunctionComponent<Props> = ({ include_call_to_action_section = true, children }) => (
    <React.Fragment>
        <div className="wrapper">
            <Navbar />
            <div className="wrapper-body">
                <div className="wrapper-content">
                    {children}
                </div>
                {include_call_to_action_section && <CallToActionSection />}
                <Footer />
            </div>
        </div>
    </React.Fragment>
)

export default DefaultPageWrapper;