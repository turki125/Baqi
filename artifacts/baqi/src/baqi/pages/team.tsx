import { useEffect } from "react";
import styles from "./team.module.css";

export default function TeamPage() {
  useEffect(() => {
    document.title = "baqi · الفريق";
  }, []);
  return (
    <div className={styles.root} lang="ar" dir="rtl">
      <svg style={{ display: "none" }} aria-hidden="true">
        <symbol id="arrow" viewBox="0 0 24 24">
          <path d="M7 17 17 7M7 7h10v10" />
        </symbol>
        <symbol id="github" viewBox="0 0 24 24">
          <path d="M9 19c-4 1-4-2-6-2m12 5v-3.9a3.4 3.4 0 0 0-.95-2.65c3.17-.35 6.5-1.56 6.5-7A5.45 5.45 0 0 0 19 4.77 5.07 5.07 0 0 0 18.91 1S17.73.65 15 2.48a13.4 13.4 0 0 0-7 0C5.27.65 4.09 1 4.09 1A5.07 5.07 0 0 0 4 4.77a5.45 5.45 0 0 0-1.55 3.78c0 5.42 3.33 6.63 6.5 7A3.4 3.4 0 0 0 8 18.1V22" />
        </symbol>
      </svg>
      <div className={styles["page"]}>
        <header>
          <a
            className={styles["wordmark"]}
            href="https://baqi-mvp.replit.app/"
            aria-label="باقي — الموقع"
          >
            baqi<span className={styles["dot"]}>.</span>
          </a>
          <div className={styles["edition"]}>
            <span className={styles["status"]}></span>GOOD MATERIALS.
            <br />
            NEW CONNECTIONS.
          </div>
        </header>
        <main>
          <section
            className={[styles["intro"], styles["reveal"]].join(" ")}
            aria-labelledby="headline"
          >
            <p className={styles["eyebrow"]}>من فائض اليوم، لبداية جديدة.</p>
            <h1 id="headline">
              باقي
              <br /> <span>فيه خير.</span>
            </h1>
            <p className={styles["description"]}>
              نعطي فائض مواد البناء فرصة ثانية.
              <br />
              تعرّف على الفريق، جرّب المنصة، واكتشف كيف بنيناها.
            </p>
            <div className={styles["materials"]}>
              <img
                className={styles["tiles"]}
                src="/team-assets/tiles.jpg"
                alt="بلاط بناء قابل لإعادة الاستخدام"
                width="260"
                height="142"
              />
              <img
                className={styles["timber"]}
                src="/team-assets/timber.jpg"
                alt="ألواح خشبية لفُرص جديدة"
                width="260"
                height="142"
              />
              <div className={styles["material-caption"]}>
                <b>A SECOND LIFE / حياة ثانية</b>
                <span>MATERIAL STUDY — 01</span>
              </div>
            </div>
          </section>
          <section
            className={[styles["team"], styles["reveal"]].join(" ")}
            aria-labelledby="team-heading"
          >
            <div className={styles["section-head"]}>
              <h2 id="team-heading">الفريق وراء باقي</h2>
              <span>MEET THE TEAM</span>
            </div>
            <a
              className={[styles["person"], styles["leader"]].join(" ")}
              href="https://www.linkedin.com/in/turki-turki-321b79378/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Turki Turki — قائد فريق باقي — LinkedIn"
            >
              <span className={styles["avatar"]} aria-hidden="true">
                T
              </span>
              <span className={styles["person-text"]}>
                <span className={styles["person-name"]} lang="en">
                  Turki Turki
                </span>
                <span className={styles["network"]}>
                  قائد فريق باقي ·{" "}
                  <span lang="en" dir="ltr">
                    LinkedIn
                  </span>
                </span>
              </span>
              <span className={styles["out"]}>
                <svg className={styles["icon"]} aria-hidden="true">
                  <use href="#arrow" />
                </svg>
              </span>
            </a>
            <a
              className={styles["person"]}
              href="https://www.linkedin.com/in/anas-almuziel-a891733ab/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Anas Almuziel — عضو الفريق — LinkedIn"
            >
              <span className={styles["avatar"]} aria-hidden="true">
                A
              </span>
              <span className={styles["person-text"]}>
                <span className={styles["person-name"]} lang="en">
                  Anas Almuziel
                </span>
                <span className={styles["network"]}>
                  عضو الفريق ·{" "}
                  <span lang="en" dir="ltr">
                    LinkedIn
                  </span>
                </span>
              </span>
              <span className={styles["out"]}>
                <svg className={styles["icon"]} aria-hidden="true">
                  <use href="#arrow" />
                </svg>
              </span>
            </a>
            <a
              className={styles["person"]}
              href="https://www.linkedin.com/in/abdulrahmannnn/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="abdulrahman alhailan — عضو الفريق — LinkedIn"
            >
              <span className={styles["avatar"]} aria-hidden="true">
                A
              </span>
              <span className={styles["person-text"]}>
                <span className={styles["person-name"]} lang="en">
                  abdulrahman alhailan
                </span>
                <span className={styles["network"]}>
                  عضو الفريق ·{" "}
                  <span lang="en" dir="ltr">
                    LinkedIn
                  </span>
                </span>
              </span>
              <span className={styles["out"]}>
                <svg className={styles["icon"]} aria-hidden="true">
                  <use href="#arrow" />
                </svg>
              </span>
            </a>
            <div className={styles["links"]}>
              <a
                className={[styles["project-link"], styles["primary"]].join(
                  " ",
                )}
                href="https://github.com/turki125/Baqi"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles["link-copy"]}>
                  <strong>اكتشف المشروع على GitHub</strong>
                  <small>EXPLORE THE CODE</small>
                </span>
                <span className={styles["link-end"]}>
                  <svg className={styles["icon"]} aria-hidden="true">
                    <use href="#github" />
                  </svg>
                  <svg className={styles["icon"]} aria-hidden="true">
                    <use href="#arrow" />
                  </svg>
                </span>
              </a>
              <a
                className={[styles["project-link"], styles["secondary"]].join(
                  " ",
                )}
                href="https://baqi-mvp.replit.app/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles["link-copy"]}>
                  <strong>جرّب باقي</strong>
                  <small>OPEN THE LIVE PROJECT</small>
                </span>
                <svg className={styles["icon"]} aria-hidden="true">
                  <use href="#arrow" />
                </svg>
              </a>
            </div>
            <p className={styles["tagline"]}>
              فكرة تبدأ بمواد متبقية، وتكمل بناس يصنعون الفرق.
            </p>
          </section>
        </main>
        <footer>
          <span>فائض مواد البناء · الرياض</span>
          <span className={styles["footer-en"]}>
            LESS WASTE. MORE POSSIBILITY.
          </span>
        </footer>
      </div>
    </div>
  );
}
