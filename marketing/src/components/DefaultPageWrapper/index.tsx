import React from "react";
import { Script } from "gatsby";
import CallToActionSection from "../CallToActionSection";
import Navbar from "./Navbar";
import Footer from "./Footer";

import "./style.scss"

interface Props {
    without_call_to_action_section?: boolean
    children: React.ReactNode;
}

const microsoft_marketing_tag = `(function(w,d,t,r,u){var f,n,i;w[u]=w[u]||[],f=function(){var o={ti:"187144922", enableAutoSpaTracking: true};o.q=w[u],w[u]=new UET(o),w[u].push("pageLoad")},n=d.createElement(t),n.src=r,n.async=1,n.onload=n.onreadystatechange=function(){var s=this.readyState;s&&s!=="loaded"&&s!=="complete"||(f(),n.onload=n.onreadystatechange=null)},i=d.getElementsByTagName(t)[0],i.parentNode.insertBefore(n,i)})(window,document,"script","//bat.bing.com/bat.js","uetq");`

const DefaultPageWrapper: React.FunctionComponent<Props> = ({ without_call_to_action_section = false, children }) => (
    <React.Fragment>
        <Script id="microsoft-marketing-tag">{microsoft_marketing_tag}</Script>
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