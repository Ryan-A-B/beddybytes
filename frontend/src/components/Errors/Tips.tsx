import React from "react";

const Tips: React.FunctionComponent = () => {
    return (
        <React.Fragment>
            <section>
                <h5>The Classic</h5>
                <p>
                    If this is the first time you've seen this error message, try refreshing the page.
                </p>
            </section>
            <section>
                <h5>Try using a different browser</h5>
                <p>
                    Errors that occur on specific browsers and operating systems
                    are the most difficult for me to comprehensively test.
                    I use Brave on Android and Firefox on Ubuntu.
                    My wife uses Chrome/Safari on an iPhone 12 and Chrome on both Windows and Mac.
                    Most commonly the issues I see are with Safari especially on iPhone.
                </p>
            </section>
        </React.Fragment>
    )
}

export default Tips;