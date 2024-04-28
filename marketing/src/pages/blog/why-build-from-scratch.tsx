import React from 'react'
import type { HeadFC, PageProps } from "gatsby"
import DefaultBlogWrapper from '../../components/DefaultBlogWrapper'

const WhyFromScratchBlogPost: React.FunctionComponent = () => (
    <DefaultBlogWrapper>
        <h1>Why I built an online baby monitor from scratch</h1>
        <p>
            As a parent, you're always thinking about your child's comfort and
            safety. Is the room the right temperature? Is the car seat safely
            installed? Can the tottering toddler finally reach an exciting
            new surface which now needs to be baby proofed?
        </p>
        <p>
            As a software engineer, I've always been cognisant of privacy and
            security. As a new parent, I was even more concerned about keeping
            devices in my home secure, and data related to my daughter private.
        </p>
        <p>
            I vetoed the baby monitors my wife suggested for these reasons.
        </p>
        <p>
            We didn't like the idea of images and video of our family and our
            home being stored by any company. I didn't like how many of the
            monitors send your information from your camera to a data centre
            hundreds of kilometres away before it's sent back to your monitor.
            The history of the internet is filled with examples of unintentional
            data leaks. No matter how good a company's privacy policy is and how
            good their intentions are, if a company receives your data, then they
            could leak your data - which could then be used for many reasons other
            than the original purpose.
        </p>
        <p>
            Personally, I much prefer to steward as much of my own data as possible.
            As a result we have very few cloud-based products or devices in our home.
            This makes searching for products very difficult as well; most companies
            seem unable to conceive new ideas which aren't attached to the cloud. I
            don't want a cloud-based app for raising and lowering my blinds, processing
            my food or monitoring my water tank levels, let alone something that
            watches my daughter sleep.
        </p>
        <p>
            My wife quickly got tired of the quest for this illusive privacy-conscious
            baby monitor. Many of the products that excited her (analytics for your
            baby's sleep!), repelled me when I read their privacy policies (for example,
            images stored in perpetuity until you request deletion). While she
            long-sufferingly agreed with me, there are many more exciting things to
            online-shop for than a baby monitor. The task was delegated to me; I was to
            select a baby monitor that met my requirements, and do so quickly.
        </p>
        <p>
            I did what most other software engineers in this pickle would do: I built my
            own safe, secure online baby monitor.
        </p>
        <p>
            Privacy and convenience are classically at odds with each other, but
            our baby monitor tries to strike a good balance. I believe that the
            best way that I can protect your data is to never receive it in the
            first place. No, my baby monitor doesn't have all the bells and
            whistles like sleep analytics - it's a convenient solution that does,
            and always will, place your privacy first.
        </p>
        <p>
            So how does it work? If you've got two devices (one with a camera)
            already connected to your home network and an internet connection,
            you've got everything you need. By using a web browser on your
            devices, our baby monitor is able to stream video directly between
            them. Besides privacy, this setup has other advantages:
        </p>
        <table className="table">
            <thead>
                <tr>
                    <th scope="col">
                        Keep it short and sweet for me
                        (what my wife would say)
                    </th>
                    <th scope="col">
                        I love the nitty, gritty technical details
                        (what I would say)
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>
                        No lagging or buffering of your video stream
                    </td>
                    <td>
                        Because your data is sent over your home network instead
                        of to a data centre and back, depending on the devices
                        you're using, you can expect less than 100ms of latency
                        between your camera and monitor (tested with a 7 year
                        old Samsung Galaxy S7 and a 2 year old laptop)
                    </td>
                </tr>
                <tr>
                    <td>
                        By keeping your video stream within your home network you
                        conserve bandwidth and reduce your internet usage.
                    </td>
                    <td>
                        Video streams can chew up a lot of bandwidth; for example,
                        a 720p video stream using 2mbps would use over 1.5GB of
                        both upload and download for a single 2 hour nap (if
                        you're a lucky duck whose baby has consolidated sleep
                        cycles).
                    </td>
                </tr>
                <tr>
                    <td>
                        Extra security and privacy
                    </td>
                    <td>
                        <p>

                            Two levels of security work for you. The first layer
                            is that your account with us is password protected.
                            The second layer is your router's security; by default
                            only devices on your home network will be able to
                            connect to each other.
                        </p>
                        <p>
                            At its core, this baby monitor uses WebRTC which operates
                            in a peer to peer fashion between your devices on your
                            local network. This means that after an initial
                            discovery phase no data needs to leave your local
                            network.
                        </p>
                    </td>
                </tr>
                <tr>
                    <td>
                        This is a flexible system that can grow with your family.
                        Connect as many monitors and cameras as your heart desires.
                    </td>
                    <td>
                        Need to hang some washing outside? Open the monitor on your
                        phone and take it with you. Need your partner to keep an eye
                        on the monitor while you go to the bathroom? They can open
                        the monitor on their phone or computer.
                        Have more than one child and want to connect another camera?
                        Not a problem, please do.
                    </td>
                </tr>
            </tbody>
        </table>
        <p>
            That's the long and short of it. We use the monitor every day, and we've
            had my daughter's grandparents use it when babysitting.
        </p>
    </DefaultBlogWrapper>
)

export default WhyFromScratchBlogPost

export const Head: HeadFC = () => <title>Why I build a baby monitor from scratch</title>