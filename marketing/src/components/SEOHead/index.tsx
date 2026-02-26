import React from 'react';
import { graphql, useStaticQuery } from 'gatsby';

interface Props {
    title: string;
    description?: string;
    noindex?: boolean;
    pathname?: string;
    type?: 'website' | 'article';
}

interface SiteMetadataQuery {
    site: {
        siteMetadata: {
            siteUrl?: string;
            title?: string;
        }
    }
}

const SEOHead: React.FunctionComponent<Props> = ({ title, description, noindex, pathname, type = 'website' }) => {
    const data = useStaticQuery<SiteMetadataQuery>(graphql`
        query SEOHeadSiteMetadata {
            site {
                siteMetadata {
                    siteUrl
                    title
                }
            }
        }
    `)

    if (noindex !== true && description === undefined)
        throw new Error('description is required if noindex is not true');

    const siteUrl = data.site.siteMetadata.siteUrl ?? '';
    const canonicalURL = pathname && siteUrl ? new URL(pathname, siteUrl).toString() : undefined;
    const socialTitle = title;
    const socialDescription = description;

    return (
        <React.Fragment>
            <html lang="en" />
            <title>{title}</title>
            {description && <meta name="description" content={description} />}
            {canonicalURL && <link rel="canonical" href={canonicalURL} />}
            {socialTitle && <meta property="og:title" content={socialTitle} />}
            {socialDescription && <meta property="og:description" content={socialDescription} />}
            {canonicalURL && <meta property="og:url" content={canonicalURL} />}
            <meta property="og:type" content={type} />
            <meta name="twitter:card" content="summary" />
            {socialTitle && <meta name="twitter:title" content={socialTitle} />}
            {socialDescription && <meta name="twitter:description" content={socialDescription} />}
            {noindex === true && <meta name="robots" content="noindex" />}
        </React.Fragment>
    )
}

export default SEOHead;
