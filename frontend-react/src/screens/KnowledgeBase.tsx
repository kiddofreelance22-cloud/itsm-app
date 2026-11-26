import React, { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, ThumbsDown, ThumbsUp } from "lucide-react";
import { Link, useRouteParams } from "../router";
import { useAsync } from "../hooks";
import { ErrorBar, SearchBox, errMsg, formatDate } from "../components/configKit";
import { knowledgeApi } from "../knowledgeApi";
import { TagList } from "./KnowledgeShared";

/* Self-service Knowledge Base. Open to every signed-in user; the API only returns articles
   written for everyone. Feedback given here is what feeds the SKMS dashboard's deflection
   rate and article ratings. */

export function KnowledgeBasePage() {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");

  // Search as the person types, without a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const { data, loading, error } = useAsync(() => knowledgeApi.portalArticles(query), [query]);
  const articles = data ?? [];

  return (
    <>
      <div className="page-header-row">
        <div className="page-header-left">
          <div className="breadcrumb">Self-Service &gt; Knowledge Base</div>
          <div className="page-title">Knowledge Base</div>
          <div className="page-subtitle">Step-by-step fixes for common problems. Search before you log an incident.</div>
        </div>
      </div>
      <div className="page-body">
        <div className="kb-search">
          <SearchBox value={text} onChange={setText} placeholder="Describe the problem, e.g. VPN keeps disconnecting" />
        </div>
        <ErrorBar msg={error ?? ""} />

        {loading && !data ? (
          <div className="spinner-row">Loading…</div>
        ) : articles.length === 0 && !error ? (
          <div className="card kb-empty">
            {query ? (
              <>
                <strong>No articles match “{query}”.</strong>
                <p>Try different words, or log an incident and the service desk will help.</p>
                <Link to="/new-incident" className="btn-primary">Log an incident</Link>
              </>
            ) : (
              <>
                <strong>No articles are published yet.</strong>
                <p>If something is not working, log an incident and the service desk will help.</p>
                <Link to="/new-incident" className="btn-primary">Log an incident</Link>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="kb-count" aria-live="polite">
              {query ? `${articles.length} result${articles.length === 1 ? "" : "s"} for “${query}”` : "Most useful articles"}
            </div>
            <ul className="kb-list">
              {articles.map((a) => (
                <li key={a.articleId}>
                  <Link to={`/knowledge-base/${a.articleId}`} className="card kb-item">
                    <div className="skms-asset-meta">
                      <span className="skms-code">{a.articleCode}</span>
                      <span className="skms-chip">{a.articleType}</span>
                      {a.serviceLine && <span className="skms-chip">{a.serviceLine}</span>}
                    </div>
                    <div className="skms-asset-title">{a.title}</div>
                    <p className="kb-snippet">{a.snippet}</p>
                    <TagList tags={a.tags} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ one article */

export function KnowledgeArticlePage() {
  const id = Number(useRouteParams("/knowledge-base/:id")?.id);
  const valid = Number.isInteger(id) && id > 0;
  const { data: article, loading, error } = useAsync(
    () => (valid ? knowledgeApi.portalArticle(id) : Promise.reject(new Error("Article not found"))),
    [id],
  );

  return (
    <>
      <div className="page-header-row">
        <div className="page-header-left">
          <div className="breadcrumb">Self-Service &gt; Knowledge Base</div>
          <div className="page-title">{article?.title ?? "Article"}</div>
        </div>
        <div className="skms-actions">
          <Link to="/knowledge-base" className="btn-ghost"><ArrowLeft size={14} /> All articles</Link>
        </div>
      </div>
      <div className="page-body">
        {loading && !article ? <div className="spinner-row">Loading…</div> : null}
        {!loading && !article ? (
          <div className="card kb-empty">
            <strong>We couldn’t find that article.</strong>
            <p>{error && error !== "Something went wrong." ? error : "It may have been unpublished or moved."}</p>
            <Link to="/knowledge-base" className="btn-primary">Browse the Knowledge Base</Link>
          </div>
        ) : null}
        {article && (
          <article className="card kb-article">
            <div className="skms-asset-meta">
              <span className="skms-code">{article.articleCode}</span>
              {article.serviceLine && <span className="skms-chip">{article.serviceLine}</span>}
              <span className="kb-reviewed">Last reviewed {formatDate(article.lastReviewedAt)}</span>
            </div>
            <TagList tags={article.tags} />
            <h3 className="kb-steps-title">{article.articleType === "Known Error" ? "Known Error workaround" : "Steps to resolve"}</h3>
            <pre className="skms-steps">{article.resolution}</pre>
            {article.enableRating && <Feedback articleId={article.articleId} />}
          </article>
        )}
      </div>
    </>
  );
}

/** “Did this solve your issue?” Yes counts as a helpful vote and a deflected ticket; No counts as unhelpful. */
function Feedback({ articleId }: { articleId: number }) {
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const send = async (yes: boolean) => {
    setBusy(true);
    setErr("");
    try {
      if (yes) {
        await knowledgeApi.recordEvent(articleId, "helpful");
        await knowledgeApi.recordEvent(articleId, "deflection");
      } else {
        await knowledgeApi.recordEvent(articleId, "unhelpful");
      }
      setAnswer(yes ? "yes" : "no");
    } catch (e) {
      setErr(errMsg(e, "We couldn’t save your answer. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  if (answer === "yes") {
    return (
      <div className="kb-feedback done" role="status">
        <CheckCircle2 size={16} aria-hidden="true" /> Glad that fixed it. Thanks for letting us know.
      </div>
    );
  }
  if (answer === "no") {
    return (
      <div className="kb-feedback" role="status">
        <div>Sorry that didn’t fix it. The service desk can take it from here.</div>
        <div className="kb-feedback-actions">
          <Link to="/new-incident" className="btn-primary">Log an incident</Link>
          <Link to="/knowledge-base" className="btn-ghost">Search other articles</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="kb-feedback">
      <strong>Did this solve your issue?</strong>
      <ErrorBar msg={err} />
      <div className="kb-feedback-actions">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void send(true)}>
          <ThumbsUp size={14} aria-hidden="true" /> Yes, it’s fixed
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => void send(false)}>
          <ThumbsDown size={14} aria-hidden="true" /> No, I still need help
        </button>
      </div>
    </div>
  );
}
