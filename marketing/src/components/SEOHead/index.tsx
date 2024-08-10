import React from 'react';

interface Props {
    title: string;
    description?: string;
    noindex?: boolean;
}

const SEOHead: React.FunctionComponent<Props> = ({ title, description, noindex }) => {
    if (noindex !== true && description === undefined)
        throw new Error('description is required if noindex is not true');
    return (
        <React.Fragment>
            <html lang="en" />
            <title>{title}</title>
            {description && <meta name="description" content={description} />}
            {noindex === true && <meta name="robots" content="noindex" />}
        </React.Fragment>
    )
}

export default SEOHead;
