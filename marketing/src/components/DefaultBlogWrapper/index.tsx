import React from 'react';
import DefaultPageWrapper from '../DefaultPageWrapper';
import { Link } from 'gatsby';

interface Props {
    children: React.ReactNode;
}

const DefaultBlogWrapper: React.FunctionComponent<Props> = ({ children }) => (
    <DefaultPageWrapper>
        <main className="bg-body-tertiary py-5">
            <div className="container">
                {children}
                <footer>
                    <Link to="/blog">Back to blog</Link>
                </footer>
            </div>
        </main>
    </DefaultPageWrapper>
)

export default DefaultBlogWrapper;