import { env } from '../config/env.js';

/**
 * Service transactionnel d'envoi d'emails via l'API REST officielle de Brevo (v3).
 * Assure la communication officielle auprès des candidats (Accusé de réception, Approbation, Rejet).
 */

/**
 * Envoie un email transactionnel via l'API Brevo.
 * 
 * @param {Object} options
 * @param {string} options.toEmail
 * @param {string} options.toName
 * @param {string} options.subject
 * @param {string} options.htmlContent
 * @param {string} options.textContent
 * @returns {Promise<Object>}
 */
export const sendBrevoEmail = async ({ toEmail, toName, subject, htmlContent, textContent }) => {
  if (!toEmail) {
    console.warn('[EmailService] Aucun destinataire spécifié. Envoi ignoré.');
    return { success: false, reason: 'NO_RECIPIENT' };
  }

  // Si Brevo n'est pas encore configuré (ex : développement local sans clés), simulation sécurisée
  if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) {
    console.log(`[EmailService] ✉️ Simulation d'envoi (clés Brevo non renseignées) vers ${toEmail} : "${subject}"`);
    return { success: true, simulated: true };
  }

  const payload = {
    sender: {
      name: env.BREVO_SENDER_NAME || 'VoteLiFy',
      email: env.BREVO_SENDER_EMAIL.trim(),
    },
    to: [
      {
        email: toEmail.trim(),
        name: toName ? toName.trim() : toEmail.trim(),
      },
    ],
    subject,
    htmlContent,
    textContent,
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': env.BREVO_API_KEY.trim(),
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[EmailService] ❌ Échec Brevo (HTTP ${response.status}) vers ${toEmail} :`, errBody);
      return { success: false, error: errBody };
    }

    const data = await response.json();
    console.log(`[EmailService]  Email Brevo envoyé avec succès à ${toEmail} (ID: ${data?.messageId || 'OK'})`);
    return { success: true, messageId: data?.messageId };
  } catch (error) {
    console.error(`[EmailService] ❌ Erreur réseau lors de l'envoi Brevo à ${toEmail} :`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Gabarit HTML partagé et soigné respectant l'identité visuelle VoteLiFy.
 */
const renderEmailLayout = ({ title, preheader, badgeText, badgeBg, badgeColor, contentHtml, footerCta = null }) => {
  const currentYear = new Date().getFullYear();
  const clientUrl = env.CLIENT_URL || 'https://votelify.com';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased; line-height: 1.6;">
  <span style="display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; mso-hide: all;">
    ${preheader}
  </span>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Conteneur principal -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- En-tête avec dégradé rouge VoteLiFy -->
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%); padding: 28px 24px; text-align: center;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <span style="display: inline-block; font-size: 26px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff; text-decoration: none;">
                      VoteLiFy
                    </span>
                    <p style="margin: 4px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 12px; font-weight: 500; letter-spacing: 0.3px;">
                      Plateforme officielle de vote et d’élections certifiées
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Corps du message -->
          <tr>
            <td style="padding: 32px 28px;">
              <!-- Badge d'état -->
              <div style="margin-bottom: 20px;">
                <span style="display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}33;">
                  ${badgeText}
                </span>
              </div>

              <!-- Contenu spécifique -->
              <div style="font-size: 14px; line-height: 1.6; color: #334155;">
                ${contentHtml}
              </div>

              ${footerCta ? `
              <!-- Bouton d'action principal -->
              <div style="margin-top: 28px; text-align: center;">
                <a href="${footerCta.url}" target="_blank" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 12px 28px; border-radius: 12px; font-weight: 700; font-size: 14px; text-decoration: none; box-shadow: 0 4px 8px rgba(220, 38, 38, 0.25);">
                  ${footerCta.label}
                </a>
              </div>
              ` : ''}

              <!-- Signature -->
              <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
                <p style="margin: 0; font-weight: 600; color: #334155;">La Commission Électorale</p>
                <p style="margin: 2px 0 0;">VoteLiFy — Scrutins transparents et certifiés</p>
              </div>
            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
              <p style="margin: 0;">
                Cet email automatique vous a été transmis suite à une opération effectuée sur 
                <a href="${clientUrl}" target="_blank" style="color: #64748b; text-decoration: underline;">VoteLiFy</a>.
              </p>
              <p style="margin: 4px 0 0;">
                Merci de ne pas répondre directement à ce message. Pour toute assistance, veuillez contacter vos administrateurs de scrutin.
              </p>
              <p style="margin: 8px 0 0; color: #cbd5e1;">
                © ${currentYear} VoteLiFy. Tous droits réservés.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * 1. Accusé de réception officiel dès le dépôt d'une candidature.
 * 
 * @param {Object} params
 * @param {Object} params.candidate
 * @param {string} params.electionTitle
 * @param {string} params.positionName
 */
export const sendCandidacySubmittedEmail = async ({ candidate, electionTitle, positionName }) => {
  if (!candidate?.email) return;

  const subject = `Accusé de réception — Candidature enregistrée | VoteLiFy`;
  const preheader = `Votre candidature pour le poste de ${positionName} a bien été enregistrée et est en cours d'examen.`;

  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Abidjan',
  });

  const contentHtml = `
    <h2 style="color: #0f172a; font-size: 18px; font-weight: 800; margin: 0 0 12px;">
      Bonjour ${candidate.fullName},
    </h2>
    <p style="margin: 0 0 14px;">
      Nous vous confirmons la bonne réception de votre dossier de candidature sur la plateforme <strong>VoteLiFy</strong>.
    </p>
    <p style="margin: 0 0 18px;">
      Votre candidature est désormais transmise à la <strong>Commission Électorale</strong> pour vérification et validation de votre éligibilité.
    </p>

    <!-- Tableau récapitulatif -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #64748b; width: 35%; font-weight: 600;">Scrutin :</td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">${electionTitle || 'Scrutin officiel'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Poste convoité :</td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">${positionName || 'Poste électoral'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Date de dépôt :</td>
          <td style="padding: 4px 0; color: #334155;">${dateStr}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Statut actuel :</td>
          <td style="padding: 4px 0; color: #d97706; font-weight: 700;">En cours d'examen</td>
        </tr>
      </table>
    </div>

    <p style="margin: 0 0 8px;">
      Vous recevrez un nouvel email dès que votre dossier aura été examiné par la Commission Électorale.
    </p>
    <p style="margin: 0; color: #64748b; font-size: 13px;">
      Aucune action supplémentaire n’est requise de votre part pour le moment.
    </p>
  `;

  const textContent = `Bonjour ${candidate.fullName},

Nous vous confirmons la bonne réception de votre dossier de candidature sur la plateforme VoteLiFy.

Récapitulatif de votre démarche :
- Scrutin : ${electionTitle || 'Scrutin officiel'}
- Poste convoité : ${positionName || 'Poste électoral'}
- Date de dépôt : ${dateStr}
- Statut actuel : En cours d'examen par la Commission Électorale

Vous recevrez un nouvel email dès que votre dossier aura été statué.

Cordialement,
La Commission Électorale — VoteLiFy`;

  const htmlContent = renderEmailLayout({
    title: subject,
    preheader,
    badgeText: "Dossier reçu · En cours d'examen",
    badgeBg: '#eff6ff',
    badgeColor: '#1d4ed8',
    contentHtml,
    footerCta: {
      url: env.CLIENT_URL || 'https://votelify.com',
      label: 'Accéder à VoteLiFy',
    },
  });

  return sendBrevoEmail({
    toEmail: candidate.email,
    toName: candidate.fullName,
    subject,
    htmlContent,
    textContent,
  });
};

/**
 * 2. Notification de validation et d'approbation officielle de candidature.
 * 
 * @param {Object} params
 * @param {Object} params.candidate
 * @param {string} params.electionTitle
 * @param {string} params.positionName
 */
export const sendCandidacyApprovedEmail = async ({ candidate, electionTitle, positionName }) => {
  if (!candidate?.email) return;

  const subject = `Félicitations ! Votre candidature est validée | VoteLiFy`;
  const preheader = `Excellente nouvelle : votre candidature pour le poste de ${positionName} a été approuvée par la Commission Électorale.`;

  const contentHtml = `
    <h2 style="color: #0f172a; font-size: 18px; font-weight: 800; margin: 0 0 12px;">
      Bonjour ${candidate.fullName},
    </h2>
    <p style="margin: 0 0 14px; font-size: 15px; color: #047857; font-weight: 700;">
      🎉 Félicitations ! Votre candidature a été officiellement approuvée.
    </p>
    <p style="margin: 0 0 16px;">
      La <strong>Commission Électorale</strong> a examiné avec succès votre dossier. Votre profil, votre photo officielle et votre programme de campagne sont désormais publiés et visibles par l'ensemble des électeurs pour le scrutin <strong>« ${electionTitle || 'Scrutin officiel'} »</strong>.
    </p>

    <!-- Détails -->
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 20px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #166534; width: 35%; font-weight: 600;">Scrutin :</td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">${electionTitle || 'Scrutin officiel'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #166534; font-weight: 600;">Poste :</td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">${positionName || 'Poste électoral'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #166534; font-weight: 600;">Statut :</td>
          <td style="padding: 4px 0; color: #047857; font-weight: 700;">Officiellement en lice</td>
        </tr>
      </table>
    </div>

    <p style="margin: 0 0 8px;">
      Vous pouvez dès à présent consulter la page officielle du scrutin et partager votre programme avec les membres électeurs.
    </p>
    <p style="margin: 0; color: #64748b; font-size: 13px;">
      Nous vous souhaitons une excellente campagne électorale dans le respect des valeurs de notre communauté.
    </p>
  `;

  const textContent = `Bonjour ${candidate.fullName},

Félicitations ! Votre candidature a été officiellement approuvée par la Commission Électorale.

Détails de votre validation :
- Scrutin : ${electionTitle || 'Scrutin officiel'}
- Poste : ${positionName || 'Poste électoral'}
- Statut : Candidature validée et publiée

Votre profil et votre programme sont dès à présent visibles par tous les électeurs sur la plateforme.

Consultez le scrutin sur : ${env.CLIENT_URL || 'https://votelify.com'}

Cordialement,
La Commission Électorale — VoteLiFy`;

  const htmlContent = renderEmailLayout({
    title: subject,
    preheader,
    badgeText: 'Candidature Approuvée & Publiée',
    badgeBg: '#ecfdf5',
    badgeColor: '#047857',
    contentHtml,
    footerCta: {
      url: env.CLIENT_URL || 'https://votelify.com',
      label: 'Voir ma candidature sur VoteLiFy',
    },
  });

  return sendBrevoEmail({
    toEmail: candidate.email,
    toName: candidate.fullName,
    subject,
    htmlContent,
    textContent,
  });
};

/**
 * 3. Notification en cas de rejet d'une candidature avec motif explicite.
 * 
 * @param {Object} params
 * @param {Object} params.candidate
 * @param {string} params.electionTitle
 * @param {string} params.positionName
 * @param {string} [params.reason]
 */
export const sendCandidacyRejectedEmail = async ({ candidate, electionTitle, positionName, reason }) => {
  if (!candidate?.email) return;

  const subject = `Information concernant votre candidature | VoteLiFy`;
  const preheader = `La Commission Électorale vous informe de la suite donnée à votre dossier pour le poste de ${positionName}.`;

  const cleanReason = reason && reason.trim().length > 0
    ? reason.trim()
    : "Le dossier ne répondait pas à l'ensemble des critères d'éligibilité définis pour ce scrutin.";

  const contentHtml = `
    <h2 style="color: #0f172a; font-size: 18px; font-weight: 800; margin: 0 0 12px;">
      Bonjour ${candidate.fullName},
    </h2>
    <p style="margin: 0 0 14px;">
      Nous vous remercions pour l’intérêt que vous portez à la vie de notre communauté et pour votre démarche de candidature.
    </p>
    <p style="margin: 0 0 16px;">
      Après un examen attentif de votre dossier pour le poste de <strong>${positionName || 'Poste électoral'}</strong> dans le cadre du scrutin <strong>« ${electionTitle || 'Scrutin officiel'} »</strong>, la Commission Électorale a le regret de vous informer que votre candidature n’a pas été retenue.
    </p>

    <!-- Motif communiqué -->
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">
        Observation de la Commission Électorale :
      </p>
      <p style="margin: 0; font-size: 13px; color: #7f1d1d; font-style: italic; line-height: 1.5;">
        « ${cleanReason} »
      </p>
    </div>

    <p style="margin: 0 0 8px;">
      Cette décision a été prise en stricte conformité avec le règlement électoral applicable à ce scrutin.
    </p>
    <p style="margin: 0; color: #64748b; font-size: 13px;">
      Nous vous remercions chaleureusement pour votre implication et votre esprit citoyen.
    </p>
  `;

  const textContent = `Bonjour ${candidate.fullName},

Nous vous remercions pour votre démarche de candidature sur VoteLiFy.

Après examen attentif de votre dossier pour le poste de ${positionName || 'Poste électoral'} (Scrutin : ${electionTitle || 'Scrutin officiel'}), la Commission Électorale a le regret de vous informer que votre candidature n'a pas été retenue.

Observation de la Commission Électorale :
"${cleanReason}"

Nous vous remercions sincèrement pour votre investissement et votre engagement pour la communauté.

Cordialement,
La Commission Électorale — VoteLiFy`;

  const htmlContent = renderEmailLayout({
    title: subject,
    preheader,
    badgeText: 'Candidature Non Retenue',
    badgeBg: '#fef2f2',
    badgeColor: '#b91c1c',
    contentHtml,
    footerCta: {
      url: env.CLIENT_URL || 'https://votelify.com',
      label: 'Accéder à la plateforme',
    },
  });

  return sendBrevoEmail({
    toEmail: candidate.email,
    toName: candidate.fullName,
    subject,
    htmlContent,
    textContent,
  });
};
