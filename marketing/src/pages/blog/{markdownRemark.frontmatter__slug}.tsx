import React from 'react';
import { graphql } from 'gatsby';
import DefaultBlogWrapper from '../../components/DefaultBlogWrapper';

const BlogPost: React.FunctionComponent<any> = ({ data }) => {
    const { markdownRemark } = data;
    const { frontmatter, html } = markdownRemark;
    return (
        <DefaultBlogWrapper>
            <h1>{frontmatter.title}</h1>
            <div dangerouslySetInnerHTML={{ __html: html }} />
        </DefaultBlogWrapper>
    )
}

export default BlogPost;

export const pageQuery = graphql`
    query($id: String!) {
        markdownRemark(id: { eq: $id }) {
            html
            frontmatter {
                date(formatString: "MMMM DD, YYYY")
                slug
                title
            }
        }
    }
`;