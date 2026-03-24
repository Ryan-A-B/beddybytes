import React from 'react';

interface Props {
    title: string;
    description?: string;
    noindex?: boolean;
    pathname?: string;
    type?: 'website' | 'article';
}

const SITE_URL = 'https://beddybytes.com';

const SEOHead: React.FunctionComponent<Props> = ({ title, description, noindex, pathname, type = 'website' }) => {
    if (noindex !== true && description === undefined)
        throw new Error('description is required if noindex is not true');

    const canonicalURL = pathname ? new URL(pathname, SITE_URL).toString() : undefined;
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
