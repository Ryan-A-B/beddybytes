import React from 'react';
import DefaultPageWrapper from '../DefaultPageWrapper';
import { Link } from 'gatsby';

interface Props {
    children: React.ReactNode;
}

const DefaultBlogWrapper: React.FunctionComponent<Props> = ({ children }) => (
    <DefaultPageWrapper>
        {children}
        <footer>
            <Link to="/blog">Back to blog</Link>
        </footer>
    </DefaultPageWrapper>
)

export default DefaultBlogWrapper;