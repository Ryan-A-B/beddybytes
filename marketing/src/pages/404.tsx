import * as React from "react"
import { HeadFC, PageProps } from "gatsby"
import DefaultPageWrapper from "../components/DefaultPageWrapper"

const NotFoundPage: React.FC<PageProps> = () => {
  return (
    <DefaultPageWrapper>
      <div className="container py-5">
        <h1 className="text-center fs-3">
          This page is as hard to find as the toy you haven't seen in 3 weeks.
        </h1>
      </div>
    </DefaultPageWrapper>
  )
}

export default NotFoundPage

export const Head: HeadFC = () => <title>Not found</title>
