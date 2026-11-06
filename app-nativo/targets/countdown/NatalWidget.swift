import WidgetKit
import SwiftUI

private let appGroup = "group.br.com.natalemfamilia.app"
private let tituloPadrao = "Natal em Família"

private let fundo = Color(red: 0x17 / 255, green: 0x1B / 255, blue: 0x18 / 255)
private let marfim = Color(red: 0xF3 / 255, green: 0xEB / 255, blue: 0xDC / 255)
private let cereja = Color(red: 0xC5 / 255, green: 0x29 / 255, blue: 0x2D / 255)
private let apagado = Color(red: 0xB9 / 255, green: 0xB2 / 255, blue: 0xA2 / 255)

struct CountdownEntry: TimelineEntry {
    let date: Date
    let alvo: Date?
    let titulo: String

    var totalHoras: Int {
        guard let alvo = alvo else { return 0 }
        return max(0, Int(alvo.timeIntervalSince(date) / 3600))
    }
    var dias: Int { totalHoras / 24 }
    var horas: Int { totalHoras % 24 }
}

private func lerData(_ texto: String?) -> Date? {
    guard let texto = texto else { return nil }
    let comFracao = ISO8601DateFormatter()
    comFracao.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let d = comFracao.date(from: texto) { return d }
    let simples = ISO8601DateFormatter()
    simples.formatOptions = [.withInternetDateTime]
    return simples.date(from: texto)
}

struct Provider: TimelineProvider {
    private func dados() -> (Date?, String) {
        let defaults = UserDefaults(suiteName: appGroup)
        let alvo = lerData(defaults?.string(forKey: "widget.event_date"))
        let t = defaults?.string(forKey: "widget.event_title")?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return (alvo, alvo == nil || t.isEmpty ? tituloPadrao : t)
    }

    func placeholder(in context: Context) -> CountdownEntry {
        CountdownEntry(date: Date(), alvo: Date().addingTimeInterval(24 * 3600 * 20), titulo: tituloPadrao)
    }

    func getSnapshot(in context: Context, completion: @escaping (CountdownEntry) -> Void) {
        let (alvo, titulo) = dados()
        completion(CountdownEntry(date: Date(), alvo: alvo, titulo: titulo))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CountdownEntry>) -> Void) {
        let (alvo, titulo) = dados()
        let agora = Date()
        guard let alvo = alvo, alvo > agora else {
            completion(Timeline(entries: [CountdownEntry(date: agora, alvo: alvo, titulo: titulo)], policy: .after(agora.addingTimeInterval(6 * 3600))))
            return
        }
        var entradas: [CountdownEntry] = []
        var momento = agora
        // Uma entrada por hora até a data, limitada às próximas 240 horas por vez.
        while momento <= alvo && entradas.count < 240 {
            entradas.append(CountdownEntry(date: momento, alvo: alvo, titulo: titulo))
            momento = momento.addingTimeInterval(3600)
        }
        let depois = entradas.last?.date.addingTimeInterval(3600) ?? agora.addingTimeInterval(3600)
        completion(Timeline(entries: entradas, policy: .after(depois)))
    }
}

struct Numero: View {
    let valor: Int
    let rotulo: String
    let cor: Color
    let tamanho: CGFloat

    var body: some View {
        VStack(spacing: 0) {
            Text("\(valor)")
                .font(.system(size: tamanho, weight: .bold, design: .serif))
                .foregroundColor(cor)
                .minimumScaleFactor(0.5)
                .lineLimit(1)
            Text(rotulo)
                .font(.system(size: 12))
                .foregroundColor(apagado)
        }
    }
}

struct NatalWidgetView: View {
    @Environment(\.widgetFamily) var familia
    let entry: CountdownEntry

    var body: some View {
        Group {
            if entry.alvo == nil {
                Text(tituloPadrao)
                    .font(.system(size: 18, weight: .bold, design: .serif))
                    .foregroundColor(marfim)
                    .multilineTextAlignment(.center)
            } else if familia == .systemSmall {
                VStack(spacing: 2) {
                    Text("NATAL EM FAMÍLIA")
                        .font(.system(size: 9, weight: .bold))
                        .tracking(1.5)
                        .foregroundColor(cereja)
                    Numero(valor: entry.dias, rotulo: entry.dias == 1 ? "dia para a ceia" : "dias para a ceia", cor: marfim, tamanho: 52)
                }
            } else {
                HStack(spacing: 14) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("NATAL EM FAMÍLIA")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(1.5)
                            .foregroundColor(cereja)
                        Text(entry.titulo)
                            .font(.system(size: 20, weight: .bold, design: .serif))
                            .foregroundColor(marfim)
                            .lineLimit(2)
                        Text("contagem para a ceia")
                            .font(.system(size: 12))
                            .foregroundColor(apagado)
                    }
                    Spacer(minLength: 0)
                    Numero(valor: entry.dias, rotulo: entry.dias == 1 ? "dia" : "dias", cor: marfim, tamanho: 44)
                    Numero(valor: entry.horas, rotulo: entry.horas == 1 ? "hora" : "horas", cor: cereja, tamanho: 44)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(fundo, for: .widget)
        .widgetURL(URL(string: "natalemfamilia://"))
    }
}

struct NatalWidget: Widget {
    let kind: String = "NatalWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            NatalWidgetView(entry: entry)
        }
        .configurationDisplayName("Natal em Família")
        .description("Quanto falta para a ceia da família.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct NatalWidgetBundle: WidgetBundle {
    var body: some Widget {
        NatalWidget()
    }
}
